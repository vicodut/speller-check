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

export type TimedModelReply<T> = {
  readonly feature: Feature;
  readonly result: Result<T, AppError>;
  readonly outcome: ModelCallOutcome;
  /** From sending the request to having the answer parsed. */
  readonly ms: number;
};

type Request = (messages: readonly ChatMessage[]) => Promise<Result<string, AppError>>;

/** One model call for a feature, timed: the call, parsing, and one retry on a bad reply. */
export const timedModelCall = async <T>(
  input: TimedModelCallInput<T>,
): Promise<TimedModelReply<T>> => {
  const now = input.now ?? (() => performance.now());
  const startedAt = now();
  // Time spent in attempts the provider gave up on (a timeout, a rejected JSON mode) doesn't count.
  let attemptStart = startedAt;
  let discarded = 0;
  const onRetry = () => {
    const at = now();
    discarded += at - attemptStart;
    attemptStart = at;
  };
  const request: Request = (messages) => {
    attemptStart = now();
    return input.provider.complete(messages, { signal: input.signal, onRetry });
  };
  const result = await completeAndParse(input, request);
  return {
    feature: input.feature,
    result,
    outcome: result.ok ? "ok" : result.error.code,
    ms: now() - startedAt - discarded,
  };
};

/** Calls the model and parses its reply, retrying once (unless cancelled) if it doesn't parse. */
const completeAndParse = async <T>(
  input: TimedModelCallInput<T>,
  request: Request,
): Promise<Result<T, AppError>> => {
  const first = await request(input.messages);
  if (!first.ok) return first;
  const parsed = input.parse(first.value);
  if (parsed.ok || input.signal?.aborted) return parsed;

  input.logger.info({ event: "parse.retry", code: parsed.error.code });
  const second = await request([...input.messages, input.retryMessage]);
  if (!second.ok) return second;
  const reparsed = input.parse(second.value);
  if (!reparsed.ok) input.logger.error({ event: "parse.failed", code: reparsed.error.code });
  return reparsed;
};
