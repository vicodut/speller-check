import type {
  ClientMessage,
  CoreMessage,
  ErrorMessage,
  RephraseDoneMessage,
  RephraseRequestMessage,
  RephraseToneMessage,
} from "@gc/protocol";
import {
  type BackgroundMessage,
  type ConnectionStatus,
  ContentMessage,
} from "../shared/port-messages";
import {
  FieldOwnershipRouter,
  fromGlobalFieldId,
  type RoutedField,
} from "./field-ownership.router";

type RephraseReply = RephraseToneMessage | RephraseDoneMessage | ErrorMessage;

/** The part of `chrome.runtime.Port` the hub uses, so tests can pass a fake. */
export type ContentPort = {
  postMessage(message: BackgroundMessage): void;
  onMessage: { addListener(listener: (message: unknown) => void): void };
  onDisconnect: { addListener(listener: () => void): void };
};

/** Sends a message to the core; returns false when it was dropped (core not ready). */
export type SendToCore = (message: ClientMessage) => boolean;

/**
 * Bridges content-script ports (one per frame) and the single core connection.
 * Frame-local field ids are prefixed with a port id on the way out and stripped on the way back.
 * A running rephrase is routed to its port even after its field closed (blur), until it ends.
 */
export class ContentPortHub {
  private readonly ports = new Map<string, ContentPort>();
  private readonly router = new FieldOwnershipRouter();
  /** Running rephrases: global field id -> request id. */
  private readonly rephrasing = new Map<string, number>();
  private nextPortId = 1;
  private status: ConnectionStatus = "connecting";

  constructor(private readonly sendToCore: SendToCore) {}

  attach(port: ContentPort): void {
    const portId = `p${this.nextPortId++}`;
    this.ports.set(portId, port);
    port.onMessage.addListener((raw) => this.fromContent(portId, raw));
    port.onDisconnect.addListener(() => this.detach(portId));
    port.postMessage({ type: "core.status", status: this.status });
  }

  /** The core connection status changed: tell every frame (they show it on the badge). */
  setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.broadcast({ type: "core.status", status });
  }

  /** Routes a validated core message to the port that owns its field. */
  fromCore(message: CoreMessage): void {
    if (message.type === "ready") {
      this.broadcast({ type: "core.ready" });
      return;
    }
    if (message.type === "settings.changed") {
      this.broadcast({ type: "core.model_changed", model: message.model, local: message.local });
      return;
    }
    if (message.fieldId === undefined) return;
    const owner = this.isRephraseReply(message)
      ? this.rephraseOwner(message.fieldId, message)
      : this.router.resolve(message.fieldId);
    if (!owner) return;
    this.ports.get(owner.portId)?.postMessage({ ...message, fieldId: owner.fieldId });
  }

  private isRephraseReply(message: CoreMessage): message is RephraseReply {
    return (
      message.type === "rephrase.tone" ||
      message.type === "rephrase.done" ||
      (message.type === "error" && message.request === "rephrase")
    );
  }

  /** The port of a running rephrase; its last reply (done or error) ends it. */
  private rephraseOwner(globalId: string, message: RephraseReply): RoutedField | undefined {
    const running = this.rephrasing.get(globalId);
    if (running === undefined || running !== message.requestId) return undefined;
    if (message.type !== "rephrase.tone") this.rephrasing.delete(globalId);
    return fromGlobalFieldId(globalId);
  }

  private fromContent(portId: string, raw: unknown): void {
    const parsed = ContentMessage.safeParse(raw);
    if (!parsed.success) return;
    const message = parsed.data;
    if (message.type === "dictionary.add") {
      this.sendToCore(message);
    } else if (message.type === "text.changed" || message.type === "text.edit") {
      this.sendToCore({ ...message, fieldId: this.router.open(portId, message.fieldId) });
    } else if (message.type === "rephrase.request") {
      this.rephrase(portId, message);
    } else {
      this.sendToCore({ ...message, fieldId: this.router.close(portId, message.fieldId) });
    }
  }

  /** A rephrase the core can't take right now fails at once, so the panel stops loading. */
  private rephrase(portId: string, message: RephraseRequestMessage): void {
    const fieldId = this.router.open(portId, message.fieldId);
    if (this.sendToCore({ ...message, fieldId })) {
      this.rephrasing.set(fieldId, message.requestId);
      return;
    }
    this.ports.get(portId)?.postMessage({
      type: "error",
      code: "core_unavailable",
      fieldId: message.fieldId,
      request: "rephrase",
      requestId: message.requestId,
    });
  }

  /** The frame went away: its fields close and its running rephrases stop. */
  private detach(portId: string): void {
    this.ports.delete(portId);
    for (const fieldId of [...this.rephrasing.keys()]) {
      if (fromGlobalFieldId(fieldId)?.portId !== portId) continue;
      this.rephrasing.delete(fieldId);
      this.sendToCore({ type: "rephrase.cancel", fieldId });
    }
    for (const fieldId of this.router.closePort(portId)) {
      this.sendToCore({ type: "field.closed", fieldId });
    }
  }

  private broadcast(message: BackgroundMessage): void {
    for (const port of this.ports.values()) port.postMessage(message);
  }
}
