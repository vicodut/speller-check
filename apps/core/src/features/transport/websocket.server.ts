import type { CoreMessage } from "@gc/protocol";
import type { Server, ServerWebSocket } from "bun";
import { type AppError, appError } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import { ConnectionHandler } from "./connection.handler";
import { isAllowedOrigin, type TokenSource } from "./connection-guard.service";
import { HttpApi } from "./http-api.handler";
import type { ServerDeps } from "./server-deps.types";

/** Hard-coded on purpose: the core must never be reachable from another machine. */
const HOSTNAME = "127.0.0.1";
const MAX_PAYLOAD_BYTES = 1024 * 1024;
const DEFAULT_HELLO_TIMEOUT_MS = 5000;

export type ServerOptions = {
  readonly port: number;
  /** Checked on every hello and API call, so a getter lets a rotated token apply at once. */
  readonly token: TokenSource;
  /** Overridable for tests only. */
  readonly helloTimeoutMs?: number;
};

type SocketData = { handler: ConnectionHandler | undefined };
type Socket = ServerWebSocket<SocketData>;

/**
 * Local transport on 127.0.0.1: the WebSocket (origin check, then hello/token auth, then message
 * routing) and, on the same port, the HTTP settings API.
 */
export class WebSocketServer {
  private server: Server<SocketData> | undefined;
  private readonly http: HttpApi;
  private readonly handlers = new Set<ConnectionHandler>();

  constructor(
    private readonly options: ServerOptions,
    private readonly deps: ServerDeps,
    private readonly logger: Logger,
  ) {
    this.http = new HttpApi(options.token, deps, logger);
  }

  start(): Result<{ port: number }, AppError> {
    try {
      this.server = Bun.serve<SocketData>({
        hostname: HOSTNAME,
        port: this.options.port,
        fetch: (request, server) =>
          this.http.handles(request)
            ? this.http.handle(request, server.port ?? this.options.port)
            : this.upgrade(request, server),
        websocket: {
          maxPayloadLength: MAX_PAYLOAD_BYTES,
          open: (ws) => this.open(ws),
          message: (ws, raw) => ws.data.handler?.receive(raw),
          close: (ws) => this.close(ws),
        },
      });
    } catch {
      this.logger.error({ event: "server.failed", code: "server_start_failed" });
      return err(appError("server_start_failed"));
    }
    const port = this.server.port ?? this.options.port;
    this.logger.info({ event: "server.started" });
    return ok({ port });
  }

  /** Sends a message to every authenticated client (others never see it). */
  broadcast(message: CoreMessage): void {
    for (const handler of this.handlers) handler.notify(message);
  }

  /** Ends every authenticated connection (after a token rotation): each must hello again. */
  revokeAll(): void {
    for (const handler of this.handlers) handler.revoke();
  }

  stop(): void {
    this.server?.stop(true);
    this.server = undefined;
  }

  private upgrade(request: Request, server: Server<SocketData>): Response | undefined {
    if (!isAllowedOrigin(request.headers.get("origin"))) {
      this.logger.info({ event: "connection.rejected", code: "origin_forbidden" });
      return new Response("Forbidden", { status: 403 });
    }
    if (server.upgrade(request, { data: { handler: undefined } })) return undefined;
    return new Response("Upgrade required", { status: 426 });
  }

  private open(ws: Socket): void {
    this.logger.info({ event: "connection.opened" });
    ws.data.handler = new ConnectionHandler(
      {
        token: this.options.token,
        helloTimeoutMs: this.options.helloTimeoutMs ?? DEFAULT_HELLO_TIMEOUT_MS,
      },
      this.deps,
      {
        send: (message) => ws.send(JSON.stringify(message)),
        close: (code, reason) => ws.close(code, reason),
      },
      this.logger,
    );
    this.handlers.add(ws.data.handler);
  }

  private close(ws: Socket): void {
    if (ws.data.handler) this.handlers.delete(ws.data.handler);
    ws.data.handler?.dispose();
    ws.data.handler = undefined;
    this.logger.info({ event: "connection.closed" });
  }
}
