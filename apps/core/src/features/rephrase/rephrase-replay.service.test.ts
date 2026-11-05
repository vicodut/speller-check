import { describe, expect, test } from "bun:test";
import { appError } from "../../shared/errors";
import { ok } from "../../shared/result";
import { caret, keepAll, reply, setup, TEXT } from "./rephrase-service.fixture";
import { RephraseCache } from "./services/rephrase-cache.service";

describe("RephraseService cache", () => {
  test("a repeat request replays every cached tone without calling the model", async () => {
    const t = setup([reply(keepAll(3))]);
    await t.run(TEXT, caret);
    const first = [...t.tones];
    t.tones.length = 0;
    const result = await t.run(TEXT, caret);
    expect(result).toEqual(ok(4));
    expect(t.prompts).toHaveLength(4);
    expect(t.tones).toEqual(first);
    expect(t.logs.filter((l) => l.includes('"rephrase.tone_cached"'))).toHaveLength(4);
  });

  test("a hit relocates the passage: same sentences elsewhere in the field", async () => {
    const t = setup([reply(keepAll(3))]);
    await t.run(TEXT, caret);
    t.tones.length = 0;
    const moved = `New intro here.\n\n${TEXT.slice(TEXT.indexOf("The meeting"))}`;
    await t.run(moved, moved.indexOf("Bring"));
    expect(t.prompts).toHaveLength(4);
    const tone = t.tones[0];
    expect(tone && moved.slice(tone.passage.start, tone.passage.end)).toBe(
      "The meeting moved to Monday. Bring the 3 reports. Thanks.",
    );
  });

  test("only the tones missing from the cache call the model", async () => {
    const t = setup([appError("provider_timeout"), reply(keepAll(3))]);
    await t.run(TEXT, caret);
    expect(t.tones.map((v) => v.tone)).toEqual(["casual", "concise", "friendlier"]);
    t.tones.length = 0;
    await t.run(TEXT, caret);
    expect(t.prompts).toHaveLength(5);
    expect(t.prompts[4]).toMatch(/TONE: professional$/);
    expect(t.tones.map((v) => v.tone)).toEqual(["professional", "casual", "concise", "friendlier"]);
  });

  test("asking for more tones replays the cached ones and calls the model for the rest", async () => {
    const t = setup([reply(keepAll(3))]);
    await t.run(TEXT, caret, undefined, ["casual"]);
    t.tones.length = 0;
    const result = await t.run(TEXT, caret, undefined, ["casual", "concise"]);
    expect(result).toEqual(ok(2));
    expect(t.prompts).toHaveLength(2);
    expect(t.prompts[1]).toMatch(/TONE: concise$/);
    expect(t.tones.map((v) => v.tone)).toEqual(["casual", "concise"]);
  });

  test("an edited passage misses the cache", async () => {
    const t = setup([reply(keepAll(3))]);
    await t.run(TEXT, caret);
    await t.run(TEXT.replace("Thanks.", "Thank you."), caret);
    expect(t.prompts).toHaveLength(8);
  });

  test("another model misses the cache", async () => {
    const cache = new RephraseCache();
    await setup([reply(keepAll(3))], { cache, model: "a" }).run(TEXT, caret);
    const b = setup([reply(keepAll(3))], { cache, model: "b" });
    await b.run(TEXT, caret);
    expect(b.prompts).toHaveLength(4);
  });
});
