import { describe, expect, test } from "bun:test";
import type { ModelIdentity } from "../providers";
import { type CallSample, samplesForCall, samplesFromAttempts } from "./call-sample.util";

const identity: ModelIdentity = { profileId: "p1", model: "qwen3:8b", local: true };
const call = { feature: "check" as const, identity, letters: 120, words: 20 };

describe("samplesFromAttempts", () => {
  test("a call that answers is one ok sample with its letters and its timing", () => {
    expect(samplesFromAttempts([{ outcome: "ok", ms: 480 }], call)).toEqual<CallSample[]>([
      { kind: "ok", feature: "check", identity, letters: 120, words: 20, ms: 480 },
    ]);
  });

  test("a failure is recorded with its code and no timing", () => {
    expect(samplesFromAttempts([{ outcome: "provider_network", ms: 15 }], call)).toEqual<
      CallSample[]
    >([{ kind: "failure", feature: "check", identity, code: "provider_network" }]);
  });

  test("a timeout is recorded as the code timeout", () => {
    expect(samplesFromAttempts([{ outcome: "provider_timeout", ms: 150_000 }], call)).toEqual<
      CallSample[]
    >([{ kind: "failure", feature: "check", identity, code: "timeout" }]);
  });

  test("an invalid first answer is a failure invalid_json, then the retry is its own sample", () => {
    const attempts = [
      { outcome: "model_invalid_json" as const, ms: 50 },
      { outcome: "ok" as const, ms: 60 },
    ];
    expect(samplesFromAttempts(attempts, call)).toEqual<CallSample[]>([
      { kind: "failure", feature: "check", identity, code: "invalid_json" },
      { kind: "ok", feature: "check", identity, letters: 120, words: 20, ms: 60 },
    ]);
  });

  test("two invalid answers are two invalid_json failures", () => {
    const attempts = [
      { outcome: "model_invalid_json" as const, ms: 50 },
      { outcome: "model_invalid_json" as const, ms: 60 },
    ];
    expect(samplesFromAttempts(attempts, call)).toEqual<CallSample[]>([
      { kind: "failure", feature: "check", identity, code: "invalid_json" },
      { kind: "failure", feature: "check", identity, code: "invalid_json" },
    ]);
  });

  test("a call abandoned by its caller (cancelled) is not recorded", () => {
    expect(samplesFromAttempts([{ outcome: "provider_cancelled", ms: 5 }], call)).toEqual([]);
    expect(
      samplesFromAttempts([{ outcome: "rephrase_cancelled", ms: 5 }], {
        ...call,
        feature: "rephrase",
      }),
    ).toEqual([]);
  });

  test("nothing is recorded without a model identity (a fake or CLI provider)", () => {
    const anonymous = { ...call, identity: undefined };
    expect(samplesFromAttempts([{ outcome: "ok", ms: 480 }], anonymous)).toEqual([]);
  });

  test("an ok call with no letters has no per-letter timing and is not recorded", () => {
    expect(samplesFromAttempts([{ outcome: "ok", ms: 480 }], { ...call, letters: 0 })).toEqual([]);
  });
});

describe("samplesForCall", () => {
  test("counts the letters and words of the texts sent, each attempt a sample", () => {
    const texts = ["Hello there.", "  second  "];
    expect(samplesForCall([{ outcome: "ok", ms: 480 }], "check", identity, texts)).toEqual<
      CallSample[]
    >([
      {
        kind: "ok",
        feature: "check",
        identity,
        letters: 22,
        words: 3,
        ms: 480,
      },
    ]);
  });

  test("a whitespace-only text has letters but no words", () => {
    const [sample] = samplesForCall([{ outcome: "ok", ms: 40 }], "rephrase", identity, ["   "]);
    expect(sample).toMatchObject({ letters: 3, words: 0 });
  });
});
