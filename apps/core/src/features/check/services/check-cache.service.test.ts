import { describe, expect, test } from "bun:test";
import { CheckCache } from "./check-cache.service";

const issue = {
  original: "has",
  suggestion: "have",
  reason: "r",
  context: "c",
  type: "grammar" as const,
  start: 2,
  end: 5,
};

describe("CheckCache", () => {
  test("returns undefined on a miss and the stored issues on a hit", () => {
    const cache = new CheckCache(10);
    expect(cache.get("m", "h1")).toBeUndefined();
    cache.set("m", "h1", [issue]);
    expect(cache.get("m", "h1")).toEqual([issue]);
  });

  test("caches clean sentences as an empty list", () => {
    const cache = new CheckCache(10);
    cache.set("m", "h1", []);
    expect(cache.get("m", "h1")).toEqual([]);
  });

  test("keys by model as well as hash", () => {
    const cache = new CheckCache(10);
    cache.set("model-a", "h1", [issue]);
    expect(cache.get("model-b", "h1")).toBeUndefined();
  });

  test("evicts the least recently used entry", () => {
    const cache = new CheckCache(2);
    cache.set("m", "a", []);
    cache.set("m", "b", []);
    cache.get("m", "a");
    cache.set("m", "c", []);
    expect(cache.get("m", "a")).toEqual([]);
    expect(cache.get("m", "b")).toBeUndefined();
    expect(cache.get("m", "c")).toEqual([]);
  });

  test("clear empties the cache", () => {
    const cache = new CheckCache(10);
    cache.set("m", "a", []);
    cache.clear();
    expect(cache.get("m", "a")).toBeUndefined();
  });

  test("rejects a non-positive capacity", () => {
    expect(() => new CheckCache(0)).toThrow();
  });
});
