import { ClientMessage, type CoreMessage } from "@gc/protocol";
import type { Logger } from "../../shared/logger";
import { currentToken, type TokenSource, tokensMatch } from "./connection-guard.service";
import { MessageRouter } from "./message-router.handler";
import type { ServerDeps } from "./server-deps.types";

/** Socket operations the handler needs; Bun's ServerWebSocket in production, a fake in tests. */
export type ConnectionSocket = {
  send(message: CoreMessage): void;
  close(code: number, reason: string): void;
};

export type ConnectionOptions = { readonly token: TokenSource; readonly helloTimeoutMs: number };

/** WebSocket close code 1008: policy violation. */
const POLICY_VIOLATION = 1008;

/**
 * One connection's state: waits for a valid `hello`, then hands messages to its router.
 * Never echoes or logs message content.
 */
export class ConnectionHandler {
  private router: MessageRouter | undefined;
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
    if (!this.router) {
      this.authenticate(message);
      return;
    }
    if (!message) {
      this.logger.info({ event: "message.invalid", len: raw.length });
      this.send({ type: "error", code: "message_invalid" });
      return;
    }
    await this.router.route(message);
  }

  /** Sends a core-wide message (e.g. `settings.changed`) once the client is authenticated. */
  notify(message: CoreMessage): void {
    if (this.router && !this.closed) this.send(message);
  }

  /** The install token changed: an authenticated client is told `auth_failed` and closed. */
  revoke(): void {
    if (this.router) this.reject();
  }

  /** Called when the socket closes, whoever closed it. */
  dispose(): void {
    this.closed = true;
    clearTimeout(this.helloTimer);
    this.router?.dispose();
    this.router = undefined;
  }

  private authenticate(message: ClientMessage | undefined): void {
    if (
      message?.type !== "hello" ||
      !tokensMatch(currentToken(this.options.token), message.token)
    ) {
      this.reject();
      return;
    }
    clearTimeout(this.helloTimer);
    this.router = new MessageRouter(this.deps, (out) => this.send(out), this.logger);
    if (this.deps.currentModels) void this.sendReady(this.deps.currentModels);
    else this.send({ type: "ready" });
  }

  /** `ready`, with the models in use when the core can say; the client hears nothing before it. */
  private async sendReady(currentModels: NonNullable<ServerDeps["currentModels"]>): Promise<void> {
    const models = await currentModels().catch(() => undefined);
    if (!this.closed) this.send({ type: "ready", ...models });
  }

  private reject(): void {
    if (this.closed) return;
    this.logger.info({ event: "connection.rejected", code: "auth_failed" });
    this.send({ type: "error", code: "auth_failed" });
    this.closed = true;
    clearTimeout(this.helloTimer);
    this.socket.close(POLICY_VIOLATION, "auth_failed");
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
