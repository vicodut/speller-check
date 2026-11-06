import type { AppError } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import type { Result } from "../../shared/result";
import type { ChatMessage, CompleteOptions, Provider } from "./provider";

/**
 * Retries a timed-out call once with a longer timeout. A local server that has to load (or
 * reload after an idle unload) its model can take longer than a normal call's timeout; the
 * retry lands on the now-loaded model instead of failing the check.
 */
export class TimeoutRetryProvider implements Provider {
  readonly model: string;

  constructor(
    private readonly inner: Provider,
    private readonly retryTimeoutMs: number,
    private readonly logger: Logger,
  ) {
    this.model = inner.model;
  }

  async complete(
    messages: readonly ChatMessage[],
    options: CompleteOptions = {},
  ): Promise<Result<string, AppError>> {
    const first = await this.inner.complete(messages, options);
    if (first.ok || first.error.code !== "provider_timeout" || options.signal?.aborted) {
      return first;
    }
    this.logger.info({ event: "provider.retry_after_timeout" });
    return this.inner.complete(messages, { ...options, timeoutMs: this.retryTimeoutMs });
  }

  listModels(): Promise<Result<string[], AppError>> {
    if (!this.inner.listModels) return Promise.resolve({ ok: true, value: [] });
    return this.inner.listModels();
  }

  healthcheck(): Promise<boolean> {
    return this.inner.healthcheck();
  }

  async warmUp(): Promise<void> {
    await this.inner.warmUp?.();
  }
}
