import { describe, expect, test } from "bun:test";
import { appError } from "../../shared/errors";
import type { ModelIdentity } from "../providers";
import type { CallSample } from "../statistics";
import { caret, keepAll, reply, setup, TEXT } from "./rephrase-service.fixture";

const identity: ModelIdentity = { profileId: "p1", model: "test-model", local: true };

const recordingSetup = (replies: Parameters<typeof setup>[0]) => {
  const samples: CallSample[] = [];
  const t = setup(replies, { identity, stats: { record: (batch) => samples.push(...batch) } });
  return { ...t, samples };
};

describe("RephraseService statistics", () => {
  test("a tone answered is one ok sample for rephrase, timed", async () => {
    const t = recordingSetup([reply(keepAll(3))]);
    await t.run(TEXT, caret, undefined, ["professional"]);
    expect(t.samples).toEqual([
      {
        kind: "ok",
        feature: "rephrase",
        identity,
        letters: expect.any(Number),
        words: expect.any(Number),
        ms: expect.any(Number),
      },
    ]);
  });

  test("the letters are the passage text sent, every character of it", async () => {
    const t = recordingSetup([reply(keepAll(1))]);
    await t.run("Hello there.", 0, undefined, ["professional"]);
    expect(t.samples).toEqual([
      { kind: "ok", feature: "rephrase", identity, letters: 12, words: 2, ms: expect.any(Number) },
    ]);
  });

  test("each tone is its own sample", async () => {
    const t = recordingSetup([reply(keepAll(3))]);
    await t.run(TEXT, caret, undefined, ["professional", "casual"]);
    expect(t.samples.map((s) => s.kind)).toEqual(["ok", "ok"]);
  });

  test("a tone served from the cache records nothing", async () => {
    const t = recordingSetup([reply(keepAll(3))]);
    await t.run(TEXT, caret, undefined, ["professional"]);
    await t.run(TEXT, caret, undefined, ["professional"]);
    expect(t.samples).toHaveLength(1);
  });

  test("a tone that fails is one failure with its code and no timing", async () => {
    const t = recordingSetup([appError("provider_network")]);
    await t.run(TEXT, caret, undefined, ["professional"]);
    expect(t.samples).toEqual([
      { kind: "failure", feature: "rephrase", identity, code: "provider_network" },
    ]);
  });

  test("an invalid first answer is an invalid_json failure, and the timed retry is an ok sample", async () => {
    const t = recordingSetup(["not json", reply(keepAll(3))]);
    await t.run(TEXT, caret, undefined, ["professional"]);
    expect(t.samples).toEqual([
      { kind: "failure", feature: "rephrase", identity, code: "invalid_json" },
      {
        kind: "ok",
        feature: "rephrase",
        identity,
        letters: expect.any(Number),
        words: expect.any(Number),
        ms: expect.any(Number),
      },
    ]);
  });

  test("an invalid answer twice is two invalid_json failures", async () => {
    const t = recordingSetup(["not json", "not json"]);
    await t.run(TEXT, caret, undefined, ["professional"]);
    expect(t.samples.map((s) => (s.kind === "failure" ? s.code : s.kind))).toEqual([
      "invalid_json",
      "invalid_json",
    ]);
  });
});
