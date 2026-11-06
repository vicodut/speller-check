import type { AppError } from "../../shared/errors";
import type { Result } from "../../shared/result";

export type ChatMessage = {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
};

/**
 * `signal` aborts the call (the caller no longer needs the reply); `timeoutMs` replaces the
 * provider's configured timeout for this call only.
 */
export type CompleteOptions = {
  readonly signal?: AbortSignal | undefined;
  readonly timeoutMs?: number | undefined;
};

/**
 * Network-only transport to a model. Returns the raw message content;
 * parsing and validation belong to the check feature.
 */
export interface Provider {
  readonly model: string;
  complete(
    messages: readonly ChatMessage[],
    options?: CompleteOptions,
  ): Promise<Result<string, AppError>>;
  listModels?(): Promise<Result<string[], AppError>>;
  healthcheck(): Promise<boolean>;
  /** Loads the model ahead of the first real call; never fails, only logs. */
  warmUp?(): Promise<void>;
}
