import type { ApiError, SettingsView, TokenView } from "@gc/protocol";
import type { AppError, ErrorCode } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import type { Result } from "../../shared/result";
import { currentToken, type TokenSource, tokensMatch } from "./connection-guard.service";
import { bearerToken, isLocalHost, isSameOrigin } from "./http-guard.util";
import { type ProbePort, routeProbe } from "./probe-routes.handler";
import { type ProfilesPort, routeProfiles } from "./profile-routes.handler";
import { type RuntimePort, routeRuntime } from "./runtime-routes.handler";
import type { SettingsPageFiles } from "./settings-page-files.repository";

/** The install token, as `core serve` keeps it: rotating also ends every authenticated connection. */
export type TokenPort = {
  rotate(): Promise<Result<string, AppError>>;
};

/** What the HTTP side needs from the rest of the core, wired in main.ts. */
export type HttpDeps = {
  /** The settings in effect, with sources; never holds an API key. */
  settingsView(): SettingsView;
  /** Saved profiles; absent in tests that don't use them. */
  readonly profiles?: ProfilesPort | undefined;
  /** Model list and Test for the profile form; absent in tests that don't use them. */
  readonly probe?: ProbePort | undefined;
  /** The local runtime; absent in tests that don't use it. */
  readonly runtime?: RuntimePort | undefined;
  /** Rotates the install token; absent in tests that don't use it. */
  readonly tokens?: TokenPort | undefined;
  /** The built settings page; absent in tests that only use the API. */
  readonly settingsPage?: SettingsPageFiles | undefined;
};

const API_PREFIX = "/api/";

/** HTTP status for each error an API route can answer with; anything else is a 500. */
const STATUS: Partial<Record<ErrorCode, number>> = {
  body_invalid: 400,
  not_found: 404,
  profile_not_found: 404,
  method_not_allowed: 405,
  profile_active: 409,
  profile_builtin: 409,
  profile_in_use: 409,
  settings_locked: 409,
  pull_in_progress: 409,
  ollama_unreachable: 409,
};

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

  private async route(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/settings") {
      if (request.method !== "GET") return this.reject("method_not_allowed", 405);
      return json(this.deps.settingsView());
    }
    if (pathname === "/api/token/rotate" && this.deps.tokens)
      return this.rotateToken(request, this.deps.tokens);
    const routed =
      (this.deps.runtime && routeRuntime(request, pathname, this.deps.runtime)) ||
      (this.deps.probe && routeProbe(request, pathname, this.deps.probe)) ||
      (this.deps.profiles && routeProfiles(request, pathname, this.deps.profiles));
    if (!routed) return this.reject("not_found", 404);
    const result = await routed;
    if (result.ok) return json(result.value);
    return this.reject(result.error.code, STATUS[result.error.code] ?? 500);
  }

  /** `POST /api/token/rotate`: answers the new token; the one this request used stops working. */
  private async rotateToken(request: Request, tokens: TokenPort): Promise<Response> {
    if (request.method !== "POST") return this.reject("method_not_allowed", 405);
    const rotated = await tokens.rotate();
    if (!rotated.ok) return this.reject(rotated.error.code, 500);
    this.logger.info({ event: "token.rotated" });
    const body: TokenView = { token: rotated.value };
    return json(body);
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
