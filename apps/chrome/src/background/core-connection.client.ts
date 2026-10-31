import { type ClientMessage, CoreMessage } from "@gc/protocol";
import type { ExtensionSettings } from "../shared/extension-settings.schema";
import type { ConnectionStatus } from "../shared/port-messages";
import { reconnectDelay } from "./reconnect-backoff.policy";

/** The part of `WebSocket` the connection uses, so tests can pass a fake. */
export type CoreSocket = {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
};

export type CoreConnectionDeps = {
  onMessage(message: CoreMessage): void;
  onStatus(status: ConnectionStatus): void;
  createSocket?: (url: string) => CoreSocket;
  schedule?: (run: () => void, ms: number) => () => void;
};

const defaultSchedule = (run: () => void, ms: number): (() => void) => {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
};

const parseCoreMessage = (data: unknown): CoreMessage | undefined => {
  if (typeof data !== "string") return undefined;
  try {
    const parsed = CoreMessage.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

/**
 * One WebSocket to the core: hello -> ready, then messages both ways.
 * Reconnects with capped exponential backoff; stops after `auth_failed` until settings change.
 * MV3: since Chrome 116, WebSocket traffic keeps the service worker alive. If the worker is
 * still stopped, it reconnects on its next start, when a content script opens a port.
 */
export class CoreConnection {
  private socket: CoreSocket | undefined;
  private settings: ExtensionSettings | undefined;
  private currentStatus: ConnectionStatus = "connecting";
  private attempt = 0;
  private cancelRetry: (() => void) | undefined;
  private readonly createSocket: (url: string) => CoreSocket;
  private readonly schedule: (run: () => void, ms: number) => () => void;

  constructor(private readonly deps: CoreConnectionDeps) {
    this.createSocket = deps.createSocket ?? ((url) => new WebSocket(url) as CoreSocket);
    this.schedule = deps.schedule ?? defaultSchedule;
  }

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  /** Applies new settings and reconnects from scratch. */
  configure(settings: ExtensionSettings): void {
    this.settings = settings;
    this.attempt = 0;
    this.teardown();
    this.setStatus("connecting");
    this.connect();
  }

  /** Sends a message once the core is ready; returns false (message dropped) otherwise. */
  send(message: ClientMessage): boolean {
    if (this.currentStatus !== "ready" || !this.socket) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  private connect(): void {
    const settings = this.settings;
    if (!settings) return;
    if (settings.token === "") {
      this.setStatus("auth_failed");
      return;
    }
    let socket: CoreSocket;
    try {
      socket = this.createSocket(`ws://127.0.0.1:${settings.port}`);
    } catch {
      this.retryLater();
      return;
    }
    this.socket = socket;
    socket.onopen = () => socket.send(JSON.stringify({ type: "hello", token: settings.token }));
    socket.onmessage = (event) => {
      if (socket === this.socket) this.handle(parseCoreMessage(event.data));
    };
    socket.onclose = () => {
      if (socket !== this.socket) return;
      this.socket = undefined;
      if (this.currentStatus !== "auth_failed") this.retryLater();
    };
  }

  private handle(message: CoreMessage | undefined): void {
    if (!message) return;
    if (message.type === "error" && message.code === "auth_failed") {
      this.setStatus("auth_failed");
      this.teardown();
      return;
    }
    if (this.currentStatus !== "ready") {
      if (message.type !== "ready") return;
      this.attempt = 0;
      this.setStatus("ready");
    }
    this.deps.onMessage(message);
  }

  private retryLater(): void {
    this.setStatus(this.currentStatus === "ready" ? "connecting" : "unreachable");
    const delay = reconnectDelay(this.attempt);
    this.attempt += 1;
    this.cancelRetry = this.schedule(() => {
      this.cancelRetry = undefined;
      this.connect();
    }, delay);
  }

  private teardown(): void {
    this.cancelRetry?.();
    this.cancelRetry = undefined;
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this.currentStatus) return;
    this.currentStatus = status;
    this.deps.onStatus(status);
  }
}
