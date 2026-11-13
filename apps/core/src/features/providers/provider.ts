import type { AppError } from "../../shared/errors";
import type { Result } from "../../shared/result";

export type ChatMessage = {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
};

/**
 * `signal` aborts the call (the caller no longer needs the reply); `timeoutMs` replaces the
 * provider's configured timeout for this call only. `onRetry` runs when a provider gives up on
 * an attempt (a timeout, a rejected JSON mode) and starts another, so a caller can time only
 * the attempt that answered.
 */
export type CompleteOptions = {
  readonly signal?: AbortSignal | undefined;
  readonly timeoutMs?: number | undefined;
  readonly onRetry?: (() => void) | undefined;
};

/**
 * Which saved profile a model belongs to, for the statistics (numbers only, no names): the
 * profile id, the model id and whether its endpoint runs on this Mac.
 */
export type ModelIdentity = {
  readonly profileId: string;
  readonly model: string;
  readonly local: boolean;
};

/**
 * Network-only transport to a model. Returns the raw message content;
 * parsing and validation belong to the check feature.
 */
export interface Provider {
  readonly model: string;
  /** Set on the stack the core builds for a profile; absent for a bare provider (tests, the CLI). */
  readonly identity?: ModelIdentity | undefined;
  complete(
    messages: readonly ChatMessage[],
    options?: CompleteOptions,
  ): Promise<Result<string, AppError>>;
  listModels?(): Promise<Result<string[], AppError>>;
  healthcheck(): Promise<boolean>;
  /** Loads the model ahead of the first real call; never fails, only logs. */
  warmUp?(): Promise<void>;
}
