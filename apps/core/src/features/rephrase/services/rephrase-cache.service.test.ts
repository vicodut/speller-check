import { describe, expect, test } from "bun:test";
import { hashPassage, RephraseCache, type ToneReply } from "./rephrase-cache.service";

const reply: ToneReply = { language: "en", segments: [{ from: 0, to: 0, text: "Hi." }] };

describe("RephraseCache", () => {
  test("returns undefined on a miss and the stored reply on a hit", () => {
    const cache = new RephraseCache(10);
    expect(cache.get("m", "h", "casual")).toBeUndefined();
    cache.set("m", "h", "casual", reply);
    expect(cache.get("m", "h", "casual")).toEqual(reply);
  });

  test("keys by model, passage and tone", () => {
    const cache = new RephraseCache(10);
    cache.set("m", "h", "casual", reply);
    expect(cache.get("other", "h", "casual")).toBeUndefined();
    expect(cache.get("m", "h2", "casual")).toBeUndefined();
    expect(cache.get("m", "h", "concise")).toBeUndefined();
  });

  test("evicts the least recently used entry", () => {
    const cache = new RephraseCache(2);
    cache.set("m", "a", "casual", reply);
    cache.set("m", "b", "casual", reply);
    cache.get("m", "a", "casual");
    cache.set("m", "c", "casual", reply);
    expect(cache.get("m", "a", "casual")).toEqual(reply);
    expect(cache.get("m", "b", "casual")).toBeUndefined();
  });

  test("rejects a capacity below one", () => {
    expect(() => new RephraseCache(0)).toThrow(RangeError);
  });
});

describe("hashPassage", () => {
  test("depends on the sentences in order, nothing else", () => {
    expect(hashPassage(["One.", "Two."])).toBe(hashPassage(["One.", "Two."]));
    expect(hashPassage(["One.", "Two."])).not.toBe(hashPassage(["One. Two."]));
    expect(hashPassage(["One.", "Two."])).not.toBe(hashPassage(["One.", "Two!"]));
  });
});
