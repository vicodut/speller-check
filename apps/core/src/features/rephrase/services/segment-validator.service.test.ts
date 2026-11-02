import { describe, expect, test } from "bun:test";
import { validateSegments } from "./segment-validator.service";

const sentences = [
  { text: "One.", start: 0, end: 4 },
  { text: "Two.", start: 5, end: 9 },
  { text: "Three.", start: 10, end: 16 },
];

const keep = (...n: number[]) => ({ sentences: n, keep: true });
const rewrite = (text: string, ...n: number[]) => ({ sentences: n, text });

describe("validateSegments", () => {
  test("maps sentence numbers to 0-based runs", () => {
    expect(validateSegments([rewrite("One and two.", 1, 2), keep(3)], sentences)).toEqual([
      { from: 0, to: 1, text: "One and two." },
      { from: 2, to: 2, keep: true },
    ]);
  });

  test.each([
    ["a gap", [keep(1), keep(3)]],
    ["a repeat", [keep(1), keep(1, 2), keep(3)]],
    ["reordering", [keep(2), keep(1), keep(3)]],
    ["a non-consecutive merge", [rewrite("x", 1, 3), keep(2)]],
    ["a missing last sentence", [keep(1), keep(2)]],
    ["a sentence past the end", [keep(1), keep(2), keep(3), keep(4)]],
    ["an empty rewrite", [keep(1), rewrite("  ", 2), keep(3)]],
    ["a malformed segment", [keep(1), "nonsense", keep(3)]],
    ["no segments", []],
  ])("rejects %s", (_name, segments) => {
    expect(validateSegments(segments, sentences)).toBeUndefined();
  });

  test("a rewrite identical to the original counts as kept", () => {
    const got = validateSegments(
      [rewrite(" One. ", 1), rewrite("One. Two.", 2), keep(3)],
      sentences,
    );
    expect(got?.[0]).toEqual({ from: 0, to: 0, keep: true });
    expect(got?.[1]).toEqual({ from: 1, to: 1, text: "One. Two." });
  });
});
