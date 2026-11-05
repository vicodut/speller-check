import { describe, expect, test } from "bun:test";
import { appError } from "../../shared/errors";
import { ok } from "../../shared/result";
import { caret, keepAll, reply, setup, TEXT } from "./rephrase-service.fixture";

describe("RephraseService", () => {
  test("one call per tone, in display order, on the caret's numbered sentences", async () => {
    const t = setup([reply(keepAll(3))]);
    const result = await t.run(TEXT, caret);
    expect(result).toEqual(ok(4));
    expect(t.prompts).toHaveLength(4);
    const passage =
      "PASSAGE:\n1. The meeting moved to Monday.\n2. Bring the 3 reports.\n3. Thanks.";
    for (const prompt of t.prompts) {
      expect(prompt).toContain(passage);
      expect(prompt).not.toContain("Intro line.");
      expect(prompt).not.toContain("DICTIONARY");
    }
    expect(t.prompts.map((p) => p.match(/TONE: (\w+)$/)?.[1])).toEqual([
      "professional",
      "casual",
      "concise",
      "friendlier",
    ]);
    expect(t.tones.map((v) => v.tone)).toEqual(["professional", "casual", "concise", "friendlier"]);
  });

  test("the prompt says every version fixes errors and never keeps one", async () => {
    const t = setup([reply(keepAll(3))]);
    await t.run(TEXT, caret);
    expect(t.prompts[0]).toContain("Fix every grammar, spelling and punctuation error.");
    expect(t.prompts[0]).toContain("Keep a sentence");
    expect(t.prompts[0]).toContain("only if it has no error");
  });

  test("sends each tone as soon as it is ready", async () => {
    const seenBeforeCall: number[] = [];
    const t = setup([reply(keepAll(3))], {
      onCall: () => seenBeforeCall.push(t.tones.length),
    });
    await t.run(TEXT, caret);
    expect(seenBeforeCall).toEqual([0, 1, 2, 3]);
  });

  test("each tone carries the passage and offsets from the core's own split", async () => {
    const merged = [
      { sentences: [1, 2], text: "Monday: bring 3 reports." },
      { sentences: [3], keep: true },
    ];
    const t = setup([reply(merged)]);
    await t.run(TEXT, caret);
    const first = t.tones[0];
    if (!first) throw new Error("no tone");
    expect(TEXT.slice(first.passage.start, first.passage.end)).toBe(
      "The meeting moved to Monday. Bring the 3 reports. Thanks.",
    );
    for (const s of first.sentences) expect(TEXT.slice(s.start, s.end)).toBe(s.text);
    expect(first.segments[0]).toEqual({ from: 0, to: 1, text: "Monday: bring 3 reports." });
    expect(first.language).toBe("en");
  });

  test("reports the language the model detected", async () => {
    const t = setup([reply(keepAll(1), "fr")]);
    await t.run("Merci beaucoup.", 0);
    expect(t.tones[0]?.language).toBe("fr");
  });

  test("refuses a caret outside any sentence without calling the model", async () => {
    const t = setup([reply([])]);
    const result = await t.run("One.\n\n\n\nTwo.", 6);
    expect(!result.ok && result.error.code).toBe("rephrase_no_sentence");
    expect(t.prompts).toHaveLength(0);
    expect(t.logs.some((l) => l.includes('"rephrase.failed"'))).toBe(true);
  });

  test("skips an invalid or failed tone and goes on with the next", async () => {
    const gap = reply([{ sentences: [1], keep: true }]);
    const t = setup([gap, appError("provider_timeout"), reply(keepAll(3))]);
    const result = await t.run(TEXT, caret);
    expect(result).toEqual(ok(2));
    expect(t.tones.map((v) => v.tone)).toEqual(["concise", "friendlier"]);
    expect(t.logs).toContain('{"level":"info","event":"rephrase.version_dropped","len":1}');
    const failed = t.logs.map((l) => JSON.parse(l)).find((l) => l.event === "rephrase.tone_failed");
    expect(failed?.code).toBe("provider_timeout");
  });

  test("no valid tone is an error", async () => {
    const t = setup([reply([])]);
    const result = await t.run(TEXT, caret);
    expect(!result.ok && result.error.code).toBe("rephrase_no_valid_version");
  });

  test("every tone failing passes the provider's error through", async () => {
    const t = setup([appError("provider_network")]);
    const result = await t.run(TEXT, caret);
    expect(!result.ok && result.error.code).toBe("provider_network");
    expect(t.prompts).toHaveLength(4);
  });

  test("retries a tone once on invalid JSON, then skips it", async () => {
    const t = setup(["not json", reply(keepAll(3)), "not json", "not json", reply(keepAll(3))]);
    const result = await t.run(TEXT, caret);
    expect(result).toEqual(ok(3));
    expect(t.tones.map((v) => v.tone)).toEqual(["professional", "concise", "friendlier"]);
    expect(t.prompts).toHaveLength(6);
  });

  test("a cancelled run stops calling the model and drops the reply in flight", async () => {
    const cancel = new AbortController();
    const t = setup([reply(keepAll(3))], {
      onCall: (call) => {
        if (call === 1) cancel.abort();
      },
    });
    const result = await t.run(TEXT, caret, cancel.signal);
    expect(!result.ok && result.error.code).toBe("rephrase_cancelled");
    expect(t.prompts).toHaveLength(2);
    expect(t.tones.map((v) => v.tone)).toEqual(["professional"]);
  });

  test("logs carry no text, only events, lengths, timings and codes", async () => {
    const t = setup([reply([{ sentences: [1, 2, 3], text: "Secret rewrite." }])]);
    await t.run(TEXT, caret);
    const events = t.logs.map((l) => JSON.parse(l).event);
    expect(events).toEqual([
      "rephrase.requested",
      ...Array(4).fill("rephrase.tone_done"),
      "rephrase.done",
    ]);
    for (const line of t.logs) {
      expect(
        Object.keys(JSON.parse(line)).every((k) =>
          ["level", "event", "ms", "len", "code"].includes(k),
        ),
      ).toBe(true);
      expect(line).not.toMatch(/meeting|Monday|reports|Secret/);
    }
  });
});
