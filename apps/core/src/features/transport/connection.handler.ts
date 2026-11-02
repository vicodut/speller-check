import { ClientMessage, type CoreMessage } from "@gc/protocol";
import type { ErrorCode } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { tokensMatch } from "./connection-guard.service";
import type { RephrasePort, ServerDeps, SessionPort } from "./server-deps.types";

/** Socket operations the handler needs; Bun's ServerWebSocket in production, a fake in tests. */
export type ConnectionSocket = {
  send(message: CoreMessage): void;
  close(code: number, reason: string): void;
};

export type ConnectionOptions = { readonly token: string; readonly helloTimeoutMs: number };

/** WebSocket close code 1008: policy violation. */
const POLICY_VIOLATION = 1008;

/** What an authenticated connection routes to. */
type Routes = { readonly session: SessionPort; readonly rephraser: RephrasePort };

/**
 * One connection's state: waits for a valid `hello`, then routes messages to its check session
 * and its rephrases. Never echoes or logs message content.
 */
export class ConnectionHandler {
  private routes: Routes | undefined;
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
    if (!this.routes) {
      this.authenticate(message);
      return;
    }
    if (!message) {
      this.logger.info({ event: "message.invalid", len: raw.length });
      this.send({ type: "error", code: "message_invalid" });
      return;
    }
    await this.route(message, this.routes);
  }

  /** Called when the socket closes, whoever closed it. */
  dispose(): void {
    this.closed = true;
    clearTimeout(this.helloTimer);
    this.routes?.session.dispose();
    this.routes?.rephraser.dispose();
    this.routes = undefined;
  }

  private authenticate(message: ClientMessage | undefined): void {
    if (message?.type !== "hello" || !tokensMatch(this.options.token, message.token)) {
      this.reject();
      return;
    }
    clearTimeout(this.helloTimer);
    const publish = (out: CoreMessage) => this.send(out);
    this.routes = {
      session: this.deps.createSession(publish),
      rephraser: this.deps.createRephraser(publish),
    };
    this.send({ type: "ready" });
  }

  /** A field closing (blur) leaves its rephrase running, so the tones still arrive. */
  private async route(message: ClientMessage, { session, rephraser }: Routes): Promise<void> {
    switch (message.type) {
      case "hello":
        return; // Already authenticated: ignored.
      case "text.changed":
        session.update({ fieldId: message.fieldId, version: message.version, text: message.text });
        rephraser.edited(message.fieldId, message.text);
        return;
      case "field.closed":
        session.close(message.fieldId);
        return;
      case "dictionary.add":
        return this.addTerm(message.term);
      case "rephrase.request":
        return rephraser.request(message);
      case "rephrase.cancel":
        rephraser.cancel(message.fieldId);
        return;
    }
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
