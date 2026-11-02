import type { z } from "zod";
import { type AppError, appError, type ErrorCode } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import { ChatCompletionResponse, ModelListResponse } from "./openai-compatible.schema";
import type { ChatMessage, CompleteOptions, Provider } from "./provider";

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export type OpenAiCompatibleConfig = {
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey?: string | undefined;
  readonly timeoutMs?: number;
  /** Omitted from requests when undefined; not every endpoint accepts it. */
  readonly reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
};

const DEFAULT_TIMEOUT_MS = 60_000;

export class OpenAiCompatibleProvider implements Provider {
  readonly model: string;
  /** Turned off for this instance's lifetime if the endpoint rejects `response_format`. */
  private jsonMode = true;

  constructor(
    private readonly config: OpenAiCompatibleConfig,
    private readonly logger: Logger,
    private readonly fetchFn: FetchFn = fetch,
  ) {
    this.model = config.model;
  }

  async complete(
    messages: readonly ChatMessage[],
    options: CompleteOptions = {},
  ): Promise<Result<string, AppError>> {
    const startedAt = performance.now();
    const len = messages.reduce((sum, m) => sum + m.content.length, 0);
    this.logger.info({ event: "provider.request", len });
    let response = await this.post(messages, options.signal);
    if (!response.ok && this.jsonMode && isRejectedJsonMode(response.error)) {
      this.jsonMode = false;
      this.logger.info({ event: "provider.json_mode_disabled" });
      response = await this.post(messages, options.signal);
    }
    if (!response.ok) return response;
    const parsed = this.parse(ChatCompletionResponse, response.value);
    if (!parsed.ok) return parsed;
    const content = parsed.value.choices[0]?.message.content ?? "";
    this.logger.info({
      event: "provider.response",
      ms: performance.now() - startedAt,
      len: content.length,
    });
    return ok(content);
  }

  async listModels(): Promise<Result<string[], AppError>> {
    const response = await this.request("/models", { method: "GET" });
    if (!response.ok) return response;
    const parsed = this.parse(ModelListResponse, response.value);
    return parsed.ok ? ok(parsed.value.data.map((m) => m.id)) : parsed;
  }

  async healthcheck(): Promise<boolean> {
    return (await this.listModels()).ok;
  }

  private post(
    messages: readonly ChatMessage[],
    signal: AbortSignal | undefined,
  ): Promise<Result<unknown, AppError>> {
    const body = {
      model: this.model,
      messages,
      temperature: 0,
      ...(this.jsonMode ? { response_format: { type: "json_object" } } : {}),
      ...(this.config.reasoningEffort ? { reasoning_effort: this.config.reasoningEffort } : {}),
    };
    const init = { method: "POST", body: JSON.stringify(body) };
    return this.request("/chat/completions", init, signal);
  }

  private async request(
    path: string,
    init: RequestInit,
    cancel?: AbortSignal,
  ): Promise<Result<unknown, AppError>> {
    const timeout = AbortSignal.timeout(this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const signal = cancel ? AbortSignal.any([timeout, cancel]) : timeout;
    try {
      const res = await this.fetchFn(`${this.config.baseUrl}${path}`, {
        ...init,
        headers: this.headers(),
        signal,
      });
      if (!res.ok) return this.fail(appError("provider_http", res.status));
      return ok(await res.json());
    } catch (cause) {
      return this.fail(appError(cancel?.aborted ? "provider_cancelled" : thrownCode(cause)));
    }
  }

  private parse<T>(schema: z.ZodType<T>, body: unknown): Result<T, AppError> {
    const parsed = schema.safeParse(body);
    return parsed.success ? ok(parsed.data) : this.fail(appError("provider_bad_response"));
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    return headers;
  }

  private fail(error: AppError): Result<never, AppError> {
    this.logger.error({ event: "provider.error", code: error.code });
    return err(error);
  }
}

const thrownCode = (cause: unknown): ErrorCode => {
  if (cause instanceof DOMException && cause.name === "TimeoutError") return "provider_timeout";
  return cause instanceof SyntaxError ? "provider_bad_response" : "provider_network";
};

const isRejectedJsonMode = (error: AppError): boolean =>
  error.code === "provider_http" && (error.status === 400 || error.status === 422);
