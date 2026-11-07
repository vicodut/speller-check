import type {
  ModelsProbe,
  ModelsResult,
  ProbeError,
  ProbeFailure,
  TestProbe,
  TestResult,
} from "@gc/protocol";
import { z } from "zod";
import type { ErrorCode } from "../../shared/errors";
import type { LogEvent, Logger } from "../../shared/logger";
import type { FetchFn } from "./openai-compatible.provider";
import { ModelListResponse } from "./openai-compatible.schema";
import { httpFailure, thrownFailure } from "./probe-error.util";

/** The key saved for a profile, if it may be sent to this base URL (settings decide). */
export type SavedKeyLookup = (profileId: string | null, baseUrl: string) => Promise<string | null>;

export type ProbeTimeouts = { readonly models: number; readonly test: number };

/** The list is quick; a test may load a cold local model first (qwen3:8b on CPU: ~70 s). */
const DEFAULT_TIMEOUTS: ProbeTimeouts = { models: 15_000, test: 90_000 };

/** A test only needs a reply; some endpoints send null content for a one-token answer. */
const AnyCompletion = z.object({ choices: z.array(z.unknown()).min(1) });

/** What each failure is logged as: a code, never the endpoint's reply. */
const LOG_CODE: Record<ProbeError, ErrorCode> = {
  unreachable: "provider_network",
  timeout: "provider_timeout",
  key_rejected: "provider_key_rejected",
  unknown_model: "provider_unknown_model",
  endpoint_error: "provider_http",
  bad_response: "provider_bad_response",
};

type Reply = { readonly ok: true; readonly body: unknown } | ProbeFailure;

/**
 * Checks a profile from the settings page, saved or not: lists its endpoint's models, or sends
 * one short chat request and times it. Keys and replies are never logged or returned.
 */
export class ProfileProbeProvider {
  constructor(
    private readonly savedKey: SavedKeyLookup,
    private readonly logger: Logger,
    private readonly fetchFn: FetchFn = fetch,
    private readonly timeouts: ProbeTimeouts = DEFAULT_TIMEOUTS,
  ) {}

  /** `GET <baseUrl>/models`: the ids, deduplicated and sorted for the page's search. */
  async models(probe: ModelsProbe): Promise<ModelsResult> {
    const startedAt = performance.now();
    const reply = await this.send(probe, "/models", { method: "GET" }, this.timeouts.models);
    if (!reply.ok) return this.failed("probe.models_failed", reply);
    const parsed = ModelListResponse.safeParse(reply.body);
    if (!parsed.success) return this.failed("probe.models_failed", badResponse);
    const models = [...new Set(parsed.data.data.map((m) => m.id))].sort();
    const ms = performance.now() - startedAt;
    this.logger.info({ event: "probe.models", ms, len: models.length });
    return { ok: true, models };
  }

  /** One chat request asking for a single token, as the warm-up does. */
  async test(probe: TestProbe): Promise<TestResult> {
    const startedAt = performance.now();
    const body = {
      model: probe.model,
      messages: [{ role: "user", content: "ok" }],
      max_tokens: 1,
      ...(probe.reasoningEffort ? { reasoning_effort: probe.reasoningEffort } : {}),
    };
    const init = { method: "POST", body: JSON.stringify(body) };
    const reply = await this.send(probe, "/chat/completions", init, this.timeouts.test);
    if (!reply.ok) return this.failed("probe.test_failed", reply);
    if (!AnyCompletion.safeParse(reply.body).success)
      return this.failed("probe.test_failed", badResponse);
    const ms = Math.round(performance.now() - startedAt);
    this.logger.info({ event: "probe.test", ms });
    return { ok: true, ms };
  }

  private async send(
    probe: ModelsProbe,
    path: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Reply> {
    const baseUrl = probe.baseUrl.replace(/\/+$/, "");
    const key =
      probe.apiKey === undefined ? await this.savedKey(probe.profileId, baseUrl) : probe.apiKey;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (key) headers.authorization = `Bearer ${key}`;
    try {
      const signal = AbortSignal.timeout(timeoutMs);
      const res = await this.fetchFn(`${baseUrl}${path}`, { ...init, headers, signal });
      if (!res.ok) return httpFailure(res.status, await res.text().catch(() => ""));
      return { ok: true, body: await res.json() };
    } catch (cause) {
      return cause instanceof SyntaxError ? badResponse : thrownFailure(cause);
    }
  }

  private failed(event: LogEvent, failure: ProbeFailure): ProbeFailure {
    this.logger.error({ event, code: LOG_CODE[failure.error] });
    return failure;
  }
}

const badResponse: ProbeFailure = { ok: false, error: "bad_response" };
