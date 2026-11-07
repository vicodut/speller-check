import type { ApiError, SettingsView } from "@gc/protocol";
import type { ErrorCode } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { tokensMatch } from "./connection-guard.service";
import { bearerToken, isLocalHost, isSameOrigin } from "./http-guard.util";

/** What the HTTP side needs from the rest of the core, wired in main.ts. */
export type HttpDeps = {
  /** The settings in effect, with sources; never holds an API key. */
  settingsView(): SettingsView;
};

const API_PREFIX = "/api/";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/**
 * Plain HTTP next to the WebSocket, on the same 127.0.0.1 port: the settings API. Every request
 * must name the core as its Host; API calls also need a same-origin (or no) Origin and the
 * install token as a bearer token.
 */
export class HttpApi {
  constructor(
    private readonly token: string,
    private readonly deps: HttpDeps,
    private readonly logger: Logger,
  ) {}

  /** Whether this request is for the HTTP side rather than a WebSocket upgrade. */
  handles(request: Request): boolean {
    return new URL(request.url).pathname.startsWith(API_PREFIX);
  }

  handle(request: Request, port: number): Response {
    if (!isLocalHost(request.headers.get("host"), port)) return this.reject("host_forbidden", 403);
    if (!isSameOrigin(request.headers.get("origin"), port))
      return this.reject("origin_forbidden", 403);
    if (!tokensMatch(this.token, bearerToken(request.headers.get("authorization"))))
      return this.reject("auth_failed", 401);
    return this.route(request);
  }

  private route(request: Request): Response {
    const { pathname } = new URL(request.url);
    if (pathname !== "/api/settings") return this.reject("not_found", 404);
    if (request.method !== "GET") return this.reject("method_not_allowed", 405);
    return json(this.deps.settingsView());
  }

  private reject(code: ErrorCode, status: number): Response {
    this.logger.info({ event: "http.rejected", code });
    const body: ApiError = { error: code };
    return json(body, status);
  }
}
