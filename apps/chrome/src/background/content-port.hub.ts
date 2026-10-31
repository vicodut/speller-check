import type { ClientMessage, CoreMessage } from "@gc/protocol";
import { type BackgroundMessage, ContentMessage } from "../shared/port-messages";
import { FieldOwnershipRouter } from "./field-ownership.router";

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
 */
export class ContentPortHub {
  private readonly ports = new Map<string, ContentPort>();
  private readonly router = new FieldOwnershipRouter();
  private nextPortId = 1;

  constructor(private readonly sendToCore: SendToCore) {}

  attach(port: ContentPort): void {
    const portId = `p${this.nextPortId++}`;
    this.ports.set(portId, port);
    port.onMessage.addListener((raw) => this.fromContent(portId, raw));
    port.onDisconnect.addListener(() => this.detach(portId));
  }

  /** Routes a validated core message to the port that owns its field. */
  fromCore(message: CoreMessage): void {
    if (message.type === "ready") {
      this.broadcast({ type: "core.ready" });
      return;
    }
    if (message.type === "settings.changed") return;
    if (message.fieldId === undefined) return;
    const owner = this.router.resolve(message.fieldId);
    if (!owner) return;
    this.ports.get(owner.portId)?.postMessage({ ...message, fieldId: owner.fieldId });
  }

  private fromContent(portId: string, raw: unknown): void {
    const parsed = ContentMessage.safeParse(raw);
    if (!parsed.success) return;
    const message = parsed.data;
    if (message.type === "dictionary.add") {
      this.sendToCore(message);
    } else if (message.type === "text.changed") {
      this.sendToCore({ ...message, fieldId: this.router.open(portId, message.fieldId) });
    } else {
      this.sendToCore({ ...message, fieldId: this.router.close(portId, message.fieldId) });
    }
  }

  private detach(portId: string): void {
    this.ports.delete(portId);
    for (const fieldId of this.router.closePort(portId)) {
      this.sendToCore({ type: "field.closed", fieldId });
    }
  }

  private broadcast(message: BackgroundMessage): void {
    for (const port of this.ports.values()) port.postMessage(message);
  }
}
