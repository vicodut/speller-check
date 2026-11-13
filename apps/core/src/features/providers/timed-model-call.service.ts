import type { Feature } from "@gc/protocol";
import type { AppError, ErrorCode } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import type { Result } from "../../shared/result";
import type { ChatMessage, Provider } from "./provider";

export type ModelCallOutcome = "ok" | ErrorCode;

export type TimedModelCallInput<T> = {
  readonly feature: Feature;
  readonly provider: Provider;
  readonly messages: readonly ChatMessage[];
  readonly parse: (raw: string) => Result<T, AppError>;
  /** Appended to the prompt for the one retry after a reply that doesn't parse. */
  readonly retryMessage: ChatMessage;
  readonly logger: Logger;
  readonly signal?: AbortSignal | undefined;
  readonly now?: () => number;
};

/**
 * One request and its parsing. `ms` covers only the attempt that answered: time spent in
 * provider retries it gave up on (a timeout) is left out.
 */
export type TimedAttempt = {
  readonly outcome: ModelCallOutcome;
  readonly ms: number;
};

export type TimedModelReply<T> = {
  readonly feature: Feature;
  readonly result: Result<T, AppError>;
  /** From sending the request to having the answer parsed. */
  readonly ms: number;
  /** Each attempt in order: one, or two when the first reply didn't parse. */
  readonly attempts: readonly TimedAttempt[];
};

/** One model call for a feature, timed: the call, parsing, and one retry on a bad reply. */
export const timedModelCall = async <T>(
  input: TimedModelCallInput<T>,
): Promise<TimedModelReply<T>> => {
  const now = input.now ?? (() => performance.now());
  const startedAt = now();
  // Time spent in attempts the provider gave up on (a timeout, a rejected JSON mode) doesn't count.
  let discarded = 0;
  const attempts: TimedAttempt[] = [];
  const attempt = async (messages: readonly ChatMessage[]) => {
    let attemptStart = now();
    const onRetry = () => {
      const at = now();
      discarded += at - attemptStart;
      attemptStart = at;
    };
    const reply = await input.provider.complete(messages, { signal: input.signal, onRetry });
    const result = reply.ok ? input.parse(reply.value) : reply;
    attempts.push({ outcome: result.ok ? "ok" : result.error.code, ms: now() - attemptStart });
    return { result, parseFailed: reply.ok && !result.ok };
  };
  const result = await completeAndParse(input, attempt);
  return {
    feature: input.feature,
    result,
    ms: now() - startedAt - discarded,
    attempts,
  };
};

type Attempt<T> = (messages: readonly ChatMessage[]) => Promise<{
  readonly result: Result<T, AppError>;
  readonly parseFailed: boolean;
}>;

/** Calls the model and parses its reply, retrying once (unless cancelled) if it doesn't parse. */
const completeAndParse = async <T>(
  input: TimedModelCallInput<T>,
  attempt: Attempt<T>,
): Promise<Result<T, AppError>> => {
  const first = await attempt(input.messages);
  if (first.result.ok || !first.parseFailed || input.signal?.aborted) return first.result;

  input.logger.info({ event: "parse.retry", code: first.result.error.code });
  const second = await attempt([...input.messages, input.retryMessage]);
  if (!second.result.ok)
    input.logger.error({ event: "parse.failed", code: second.result.error.code });
  return second.result;
};
