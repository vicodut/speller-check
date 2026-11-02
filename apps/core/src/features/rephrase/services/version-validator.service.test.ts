import { describe, expect, test } from "bun:test";
import { validateVersions } from "./version-validator.service";

const sentences = [
  { text: "One.", start: 0, end: 4 },
  { text: "Two.", start: 5, end: 9 },
  { text: "Three.", start: 10, end: 16 },
];

const version = (tone: string, segments: unknown[]) => ({ tone, segments });
const keep = (...n: number[]) => ({ sentences: n, keep: true });
const rewrite = (text: string, ...n: number[]) => ({ sentences: n, text });

describe("validateVersions", () => {
  test("maps sentence numbers to 0-based runs", () => {
    const got = validateVersions(
      [version("casual", [rewrite("One and two.", 1, 2), keep(3)])],
      sentences,
    );
    expect(got.dropped).toBe(0);
    expect(got.versions).toEqual([
      {
        tone: "casual",
        segments: [
          { from: 0, to: 1, text: "One and two." },
          { from: 2, to: 2, keep: true },
        ],
      },
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
    ["no segments", []],
  ])("drops a version with %s", (_name, segments) => {
    const got = validateVersions([version("concise", segments)], sentences);
    expect(got).toEqual({ versions: [], dropped: 1 });
  });

  test("drops unknown tones and repeated tones, keeps the valid ones in tone order", () => {
    const all = [keep(1), keep(2), keep(3)];
    const got = validateVersions(
      [
        version("friendlier", all),
        version("angry", all),
        version("professional", all),
        version("friendlier", all),
        "nonsense",
      ],
      sentences,
    );
    expect(got.versions.map((v) => v.tone)).toEqual(["professional", "friendlier"]);
    expect(got.dropped).toBe(3);
  });

  test("a rewrite identical to the original counts as kept", () => {
    const got = validateVersions(
      [version("casual", [rewrite(" One. ", 1), rewrite("One. Two.", 2), keep(3)])],
      sentences,
    );
    expect(got.versions[0]?.segments[0]).toEqual({ from: 0, to: 0, keep: true });
    expect(got.versions[0]?.segments[1]).toEqual({ from: 1, to: 1, text: "One. Two." });
  });
});
