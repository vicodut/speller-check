import type { AppError } from "../../shared/errors";
import { ok, type Result } from "../../shared/result";
import type { ChatMessage, CompleteOptions, Provider } from "./provider";

/**
 * One feature's provider, replaceable while the core runs (a settings change). Each call goes
 * to the provider current when it starts, so a call in flight finishes on the old model.
 * Work made of several calls plus a cache write (a check batch, a rephrase tone) should pin
 * the provider first (`pinProvider`), so all its calls and its cache key use one model.
 */
export class SwitchableProvider implements Provider {
  constructor(private current: Provider) {}

  get model(): string {
    return this.current.model;
  }

  swap(next: Provider): void {
    this.current = next;
  }

  pinned(): Provider {
    return this.current;
  }

  complete(
    messages: readonly ChatMessage[],
    options?: CompleteOptions,
  ): Promise<Result<string, AppError>> {
    return this.current.complete(messages, options);
  }

  listModels(): Promise<Result<string[], AppError>> {
    return this.current.listModels?.() ?? Promise.resolve(ok([]));
  }

  healthcheck(): Promise<boolean> {
    return this.current.healthcheck();
  }

  async warmUp(): Promise<void> {
    await this.current.warmUp?.();
  }
}

/** The provider to use for one unit of work: a switchable one's current provider, else itself. */
export const pinProvider = (provider: Provider): Provider =>
  provider instanceof SwitchableProvider ? provider.pinned() : provider;
