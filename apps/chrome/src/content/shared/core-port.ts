import {
  BackgroundMessage,
  type ContentMessage,
  contentPortName,
} from "../../shared/port-messages";

/**
 * This frame's port to the background. The worker may stop and drop the port (MV3),
 * so it is reopened lazily on the next send.
 */
export class CorePort {
  private port: chrome.runtime.Port | undefined;

  constructor(private readonly onMessage: (message: BackgroundMessage) => void) {}

  send(message: ContentMessage): void {
    try {
      this.ensurePort()?.postMessage(message);
    } catch {
      // Port died between checks, or the extension was reloaded: drop and reopen next time.
      this.port = undefined;
    }
  }

  private ensurePort(): chrome.runtime.Port | undefined {
    if (this.port) return this.port;
    try {
      const port = chrome.runtime.connect({ name: contentPortName });
      port.onMessage.addListener((raw: unknown) => {
        const parsed = BackgroundMessage.safeParse(raw);
        if (parsed.success) this.onMessage(parsed.data);
      });
      port.onDisconnect.addListener(() => {
        if (this.port === port) this.port = undefined;
      });
      this.port = port;
    } catch {
      // Extension context invalidated (extension reloaded): nothing to talk to.
      this.port = undefined;
    }
    return this.port;
  }
}
