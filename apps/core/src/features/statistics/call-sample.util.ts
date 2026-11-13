import type { Feature } from "@gc/protocol";
import type { ErrorCode } from "../../shared/errors";
import type { ModelIdentity, TimedAttempt } from "../providers";

/** One model call's sample for the statistics: a timed success, or a failure with its code. */
export type CallSample =
  | {
      readonly kind: "ok";
      readonly feature: Feature;
      readonly identity: ModelIdentity;
      readonly letters: number;
      readonly ms: number;
    }
  | {
      readonly kind: "failure";
      readonly feature: Feature;
      readonly identity: ModelIdentity;
      readonly code: StatisticsCode;
    };

/** The codes the statistics store: a timeout and an invalid JSON answer have their own names. */
export type StatisticsCode =
  | "timeout"
  | "invalid_json"
  | Exclude<ErrorCode, "provider_timeout" | "model_invalid_json">;

/** Calls the caller abandoned never complete, so they are not counted either way. */
const ABANDONED: ReadonlySet<ErrorCode> = new Set(["provider_cancelled", "rephrase_cancelled"]);

const codeOf = (code: ErrorCode): StatisticsCode => {
  if (code === "provider_timeout") return "timeout";
  if (code === "model_invalid_json") return "invalid_json";
  return code;
};

/**
 * Turns one call's attempts into samples: each answered attempt is an ok sample with its timing,
 * each failed attempt a failure with its code and no timing. Abandoned calls and calls with no
 * letters or no profile identity record nothing.
 */
export const samplesFromAttempts = (
  attempts: readonly TimedAttempt[],
  call: {
    readonly feature: Feature;
    readonly identity: ModelIdentity | undefined;
    readonly letters: number;
  },
): CallSample[] => {
  const { identity, feature, letters } = call;
  if (!identity) return [];
  return attempts.flatMap((attempt): CallSample[] => {
    if (attempt.outcome === "ok") {
      return letters > 0 ? [{ kind: "ok", feature, identity, letters, ms: attempt.ms }] : [];
    }
    // Past the "ok" check, the outcome is narrowed to the error codes (ModelCallOutcome minus "ok").
    const outcome = attempt.outcome;
    if (ABANDONED.has(outcome)) return [];
    return [{ kind: "failure", feature, identity, code: codeOf(outcome) }];
  });
};
