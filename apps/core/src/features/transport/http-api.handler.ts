import type { ApiError, SettingsView } from "@gc/protocol";
import type { ErrorCode } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { currentToken, type TokenSource, tokensMatch } from "./connection-guard.service";
import { bearerToken, isLocalHost, isSameOrigin } from "./http-guard.util";
import type { SettingsPageFiles } from "./settings-page-files.repository";

/** What the HTTP side needs from the rest of the core, wired in main.ts. */
export type HttpDeps = {
  /** The settings in effect, with sources; never holds an API key. */
  settingsView(): SettingsView;
  /** The built settings page; absent in tests that only use the API. */
  readonly settingsPage?: SettingsPageFiles | undefined;
};

const API_PREFIX = "/api/";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/**
 * Plain HTTP next to the WebSocket, on the same 127.0.0.1 port: the settings page and its API.
 * Every request must name the core as its Host. The page's files need nothing more (they hold
 * no data); API calls also need a same-origin (or no) Origin and the install token.
 */
export class HttpApi {
  constructor(
    private readonly token: TokenSource,
    private readonly deps: HttpDeps,
    private readonly logger: Logger,
  ) {}

  /** Whether this request is for the HTTP side rather than a WebSocket upgrade. */
  handles(request: Request): boolean {
    const { pathname } = new URL(request.url);
    return pathname.startsWith(API_PREFIX) || !!this.deps.settingsPage?.serves(pathname);
  }

  async handle(request: Request, port: number): Promise<Response> {
    if (!isLocalHost(request.headers.get("host"), port)) return this.reject("host_forbidden", 403);
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith(API_PREFIX)) return this.page(request, pathname);
    if (!isSameOrigin(request.headers.get("origin"), port))
      return this.reject("origin_forbidden", 403);
    const given = bearerToken(request.headers.get("authorization"));
    if (!tokensMatch(currentToken(this.token), given)) return this.reject("auth_failed", 401);
    return this.route(request);
  }

  private route(request: Request): Response {
    const { pathname } = new URL(request.url);
    if (pathname !== "/api/settings") return this.reject("not_found", 404);
    if (request.method !== "GET") return this.reject("method_not_allowed", 405);
    return json(this.deps.settingsView());
  }

  private async page(request: Request, pathname: string): Promise<Response> {
    if (request.method !== "GET") return this.reject("method_not_allowed", 405);
    return (await this.deps.settingsPage?.read(pathname)) ?? this.reject("not_found", 404);
  }

  private reject(code: ErrorCode, status: number): Response {
    this.logger.info({ event: "http.rejected", code });
    const body: ApiError = { error: code };
    return json(body, status);
  }
}
