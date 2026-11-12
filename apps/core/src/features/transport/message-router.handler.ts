import {
  type ClientMessage,
  type CoreMessage,
  isTextTooLong,
  type RephraseRequestMessage,
  type TextEditMessage,
} from "@gc/protocol";
import type { ErrorCode } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { ReceivedTexts } from "./received-texts.store";
import type { RephrasePort, ServerDeps, SessionPort } from "./server-deps.types";

/**
 * Routes an authenticated connection's messages to its check session and its rephrases.
 * Never echoes or logs message content.
 */
export class MessageRouter {
  /** Each open field's last received text: the base a `text.edit` applies to. */
  private readonly texts = new ReceivedTexts();
  private readonly session: SessionPort;
  private readonly rephraser: RephrasePort;

  constructor(
    private readonly deps: ServerDeps,
    private readonly send: (message: CoreMessage) => void,
    private readonly logger: Logger,
  ) {
    this.session = deps.createSession(send);
    this.rephraser = deps.createRephraser(send);
  }

  /** A field closing (blur) leaves its rephrase running, so the tones still arrive. */
  async route(message: ClientMessage): Promise<void> {
    switch (message.type) {
      case "hello":
      case "proof":
        return; // Handshake messages once authenticated: ignored.
      case "ping":
        return; // Keepalive from the Chrome extension: nothing to do, nothing to log.
      case "text.changed":
        this.texts.received(message.fieldId, message.version, message.text);
        return this.textChanged(message.fieldId, message.version, message.text);
      case "text.edit":
        return this.applyEdit(message);
      case "field.closed":
        this.texts.drop(message.fieldId);
        this.session.close(message.fieldId);
        return;
      case "dictionary.add":
        return this.addTerm(message.term);
      case "rephrase.request":
        if (isTextTooLong(message.text)) return this.refuseRephrase(message);
        return this.rephraser.request(message);
      case "rephrase.cancel":
        this.rephraser.cancel(message.fieldId);
        return;
    }
  }

  dispose(): void {
    this.session.dispose();
    this.rephraser.dispose();
  }

  /** A full text or one rebuilt from an edit: the same check and rephrase path either way. */
  private textChanged(fieldId: string, version: number, text: string): void {
    this.session.update({ fieldId, version, text });
    this.rephraser.edited(fieldId, text);
  }

  /** An edit the core can't apply (unknown field, other base, out of range) asks for a resync. */
  private applyEdit(message: TextEditMessage): void {
    const { fieldId, version } = message;
    const text = this.texts.applyEdit(message);
    if (text === undefined) {
      this.logger.info({ event: "text.resync_needed", code: "resync_needed" });
      this.send({ type: "error", code: "resync_needed", fieldId });
      return;
    }
    if (isTextTooLong(text)) {
      // Safety net: clients don't grow a field past the cap. Refused before any model call.
      this.texts.drop(fieldId);
      this.logger.error({ event: "check.failed", code: "text_too_long", len: text.length });
      this.send({ type: "error", code: "text_too_long", fieldId });
      return;
    }
    this.logger.info({ event: "text.edit_applied", len: text.length });
    this.textChanged(fieldId, version, text);
  }

  private async addTerm(term: string): Promise<void> {
    const result = await this.deps.addDictionaryTerm(term);
    if (result.ok) this.logger.info({ event: "dictionary.added" });
    else this.fail(result.error.code);
  }

  /** Safety net: clients don't send text over the cap. Refused before any model call. */
  private refuseRephrase({ fieldId, requestId, text }: RephraseRequestMessage): void {
    const code = "text_too_long";
    this.logger.error({ event: "rephrase.failed", code, len: text.length });
    this.send({ type: "error", code, fieldId, request: "rephrase", requestId });
  }

  private fail(code: ErrorCode): void {
    this.logger.error({ event: "dictionary.add_failed", code });
    this.send({ type: "error", code });
  }
}
