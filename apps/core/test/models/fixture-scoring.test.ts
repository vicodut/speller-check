import { describe, expect, test } from "bun:test";
import type { Issue } from "@gc/protocol";
import type { FixtureCase } from "./fixture.schema";
import { occurrences, scoreCase } from "./fixture-scoring";

const fixture: FixtureCase = {
  id: "c",
  text: "The NestJS module were loaded.",
  expect: [{ original: "were", accept: ["was"] }],
  mustNotFlag: ["NestJS"],
};
const at = (start: number, end: number, suggestion: string): Issue => ({
  original: fixture.text.slice(start, end),
  suggestion,
  reason: "r",
  context: "c",
  type: "grammar",
  start,
  end,
});

describe("scoreCase", () => {
  test("counts an overlapping issue as a hit and checks its suggestion", () => {
    const score = scoreCase(fixture, [at(18, 22, "was")]);
    expect(score.hits).toEqual([{ original: "were", suggestion: "was", accepted: true }]);
    expect(score.misses).toEqual([]);
    expect(score.extras).toEqual([]);
  });

  test("reports misses, extras and dictionary violations", () => {
    const score = scoreCase(fixture, [at(4, 10, "Nest JS")]);
    expect(score.misses).toEqual(["were"]);
    expect(score.extras).toHaveLength(1);
    expect(score.violations).toEqual(["NestJS"]);
  });

  test("does not treat a fix that keeps the term as a violation", () => {
    expect(scoreCase(fixture, [at(4, 22, "NestJS module was")]).violations).toEqual([]);
  });
});

test("occurrences matches whole words only", () => {
  expect(occurrences("the theme the", "the")).toEqual([
    { start: 0, end: 3 },
    { start: 10, end: 13 },
  ]);
});
