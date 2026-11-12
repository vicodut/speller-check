import { ClientMessage, type CoreMessage } from "@gc/protocol";
import type { Logger } from "../../shared/logger";
import { currentToken, type TokenSource } from "./connection-guard.service";
import { newNonce, signProof, verifyProof } from "./handshake-proof.util";
import { MessageRouter } from "./message-router.handler";
import type { ServerDeps } from "./server-deps.types";

/** Socket operations the handler needs; Bun's ServerWebSocket in production, a fake in tests. */
export type ConnectionSocket = {
  send(message: CoreMessage): void;
  close(code: number, reason: string): void;
};

/** `helloTimeoutMs`: how long the client has to send a valid proof after the challenge. */
export type ConnectionOptions = { readonly token: TokenSource; readonly helloTimeoutMs: number };

/** WebSocket close code 1008: policy violation. */
const POLICY_VIOLATION = 1008;

type RejectCode = "auth_failed" | "update_extension";

/**
 * One connection's state: sends a challenge, waits for a valid proof of the install token,
 * answers `ready` with its own proof, then hands messages to its router. The token never
 * crosses the wire. Never echoes or logs message content.
 */
export class ConnectionHandler {
  private router: MessageRouter | undefined;
  private closed = false;
  private readonly helloTimer: ReturnType<typeof setTimeout>;
  private readonly nonce = newNonce();

  constructor(
    private readonly options: ConnectionOptions,
    private readonly deps: ServerDeps,
    private readonly socket: ConnectionSocket,
    private readonly logger: Logger,
  ) {
    this.helloTimer = setTimeout(() => this.reject(), options.helloTimeoutMs);
    this.send({ type: "challenge", nonce: this.nonce });
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

  /** An extension that predates the handshake sends `hello`: it is told to update. */
  private authenticate(message: ClientMessage | undefined): void {
    if (message?.type === "hello") {
      this.reject("update_extension");
      return;
    }
    // Read once: the proof checked and the proof sent back use the same token.
    const token = currentToken(this.options.token);
    if (
      message?.type !== "proof" ||
      !token ||
      !verifyProof(token, "client", this.nonce, message.nonce, message.proof)
    ) {
      this.reject();
      return;
    }
    clearTimeout(this.helloTimer);
    this.router = new MessageRouter(this.deps, (out) => this.send(out), this.logger);
    const proof = signProof(token, "core", this.nonce, message.nonce);
    if (this.deps.currentModels) void this.sendReady(proof, this.deps.currentModels);
    else this.send({ type: "ready", proof });
  }

  /**
   * `ready` with the core's proof, and the models in use when the core can say; the client
   * hears nothing else before it.
   */
  private async sendReady(
    proof: string,
    currentModels: NonNullable<ServerDeps["currentModels"]>,
  ): Promise<void> {
    const models = await currentModels().catch(() => undefined);
    if (!this.closed) this.send({ type: "ready", proof, ...models });
  }

  private reject(code: RejectCode = "auth_failed"): void {
    if (this.closed) return;
    this.logger.info({ event: "connection.rejected", code });
    this.send({ type: "error", code });
    this.closed = true;
    clearTimeout(this.helloTimer);
    this.socket.close(POLICY_VIOLATION, code);
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
