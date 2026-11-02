import { ClientMessage, type CoreMessage, type RephraseRequestMessage } from "@gc/protocol";
import type { ErrorCode } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { tokensMatch } from "./connection-guard.service";
import type { ServerDeps, SessionPort } from "./server-deps.types";

/** Socket operations the handler needs; Bun's ServerWebSocket in production, a fake in tests. */
export type ConnectionSocket = {
  send(message: CoreMessage): void;
  close(code: number, reason: string): void;
};

export type ConnectionOptions = { readonly token: string; readonly helloTimeoutMs: number };

/** WebSocket close code 1008: policy violation. */
const POLICY_VIOLATION = 1008;

/**
 * One connection's state: waits for a valid `hello`, then routes messages to its session.
 * Never echoes or logs message content.
 */
export class ConnectionHandler {
  private session: SessionPort | undefined;
  private closed = false;
  private readonly helloTimer: ReturnType<typeof setTimeout>;

  constructor(
    private readonly options: ConnectionOptions,
    private readonly deps: ServerDeps,
    private readonly socket: ConnectionSocket,
    private readonly logger: Logger,
  ) {
    this.helloTimer = setTimeout(() => this.reject(), options.helloTimeoutMs);
  }

  async receive(raw: string | Buffer): Promise<void> {
    if (this.closed) return;
    const message = parseClientMessage(raw);
    if (!this.session) {
      this.authenticate(message);
      return;
    }
    if (!message) {
      this.logger.info({ event: "message.invalid", len: raw.length });
      this.send({ type: "error", code: "message_invalid" });
      return;
    }
    await this.route(message, this.session);
  }

  /** Called when the socket closes, whoever closed it. */
  dispose(): void {
    this.closed = true;
    clearTimeout(this.helloTimer);
    this.session?.dispose();
    this.session = undefined;
  }

  private authenticate(message: ClientMessage | undefined): void {
    if (message?.type !== "hello" || !tokensMatch(this.options.token, message.token)) {
      this.reject();
      return;
    }
    clearTimeout(this.helloTimer);
    this.session = this.deps.createSession((out) => this.send(out));
    this.send({ type: "ready" });
  }

  private async route(message: ClientMessage, session: SessionPort): Promise<void> {
    switch (message.type) {
      case "hello":
        return; // Already authenticated: ignored.
      case "text.changed":
        session.update({ fieldId: message.fieldId, version: message.version, text: message.text });
        return;
      case "field.closed":
        session.close(message.fieldId);
        return;
      case "dictionary.add":
        return this.addTerm(message.term);
      case "rephrase.request":
        return this.rephrase(message);
    }
  }

  /** Answers with the result, or an error tagged `request: "rephrase"` (never a failed check). */
  private async rephrase(message: RephraseRequestMessage): Promise<void> {
    const { fieldId, version } = message;
    const result = await this.deps.rephrase({ text: message.text, caret: message.caret });
    if (result.ok) this.send({ type: "rephrase.result", fieldId, version, ...result.value });
    else this.send({ type: "error", code: result.error.code, fieldId, request: "rephrase" });
  }

  private async addTerm(term: string): Promise<void> {
    const result = await this.deps.addDictionaryTerm(term);
    if (result.ok) this.logger.info({ event: "dictionary.added" });
    else this.fail(result.error.code);
  }

  private reject(): void {
    if (this.closed) return;
    this.logger.info({ event: "connection.rejected", code: "auth_failed" });
    this.send({ type: "error", code: "auth_failed" });
    this.closed = true;
    clearTimeout(this.helloTimer);
    this.socket.close(POLICY_VIOLATION, "auth_failed");
  }

  private fail(code: ErrorCode): void {
    this.logger.error({ event: "dictionary.add_failed", code });
    this.send({ type: "error", code });
  }

  private send(message: CoreMessage): void {
    if (!this.closed) this.socket.send(message);
  }
}

const parseClientMessage = (raw: string | Buffer): ClientMessage | undefined => {
  if (typeof raw !== "string") return undefined;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const parsed = ClientMessage.safeParse(json);
  return parsed.success ? parsed.data : undefined;
};
