import { describe, expect, test } from "bun:test";
import { splitBatches } from "./sentence-batcher.service";

const sentence = (length: number) => ({ text: "a".repeat(length) });
const sizes = (batches: { text: string }[][]) => batches.map((b) => b.length);

describe("splitBatches", () => {
  test("returns no batch for no sentence", () => {
    expect(splitBatches([], { maxSentences: 20, maxChars: 3000 })).toEqual([]);
  });

  test("keeps a short list in one batch", () => {
    const all = [sentence(10), sentence(10), sentence(10)];
    expect(splitBatches(all, { maxSentences: 20, maxChars: 3000 })).toEqual([all]);
  });

  test("cuts at the sentence limit, in document order", () => {
    const all = Array.from({ length: 45 }, (_, i) => ({ text: `s${i}` }));
    const batches = splitBatches(all, { maxSentences: 20, maxChars: 3000 });
    expect(sizes(batches)).toEqual([20, 20, 5]);
    expect(batches.flat()).toEqual(all);
  });

  test("cuts before a sentence that would go over the character limit", () => {
    const all = [sentence(1000), sentence(1500), sentence(600), sentence(100)];
    expect(sizes(splitBatches(all, { maxSentences: 20, maxChars: 3000 }))).toEqual([2, 2]);
  });

  test("a batch of exactly the character limit is allowed", () => {
    const all = [sentence(1500), sentence(1500), sentence(1)];
    expect(sizes(splitBatches(all, { maxSentences: 20, maxChars: 3000 }))).toEqual([2, 1]);
  });

  test("a single sentence over the character limit gets a batch of its own", () => {
    const all = [sentence(10), sentence(4000), sentence(10)];
    expect(sizes(splitBatches(all, { maxSentences: 20, maxChars: 3000 }))).toEqual([1, 1, 1]);
  });
});
