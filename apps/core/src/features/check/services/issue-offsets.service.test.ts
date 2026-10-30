import { describe, expect, test } from "bun:test";
import type { Issue } from "@gc/protocol";
import { dropOverlaps, shiftIssue } from "./issue-offsets.service";

const at = (start: number, end: number): Issue => ({
  original: "x",
  suggestion: "y",
  reason: "r",
  context: "c",
  type: "spelling",
  start,
  end,
});

describe("shiftIssue", () => {
  test("moves both offsets", () => {
    expect(shiftIssue(at(2, 5), 10)).toMatchObject({ start: 12, end: 15 });
    expect(shiftIssue(at(12, 15), -10)).toMatchObject({ start: 2, end: 5 });
  });
});

describe("dropOverlaps", () => {
  test("sorts by start", () => {
    expect(dropOverlaps([at(8, 9), at(0, 3)])).toEqual([at(0, 3), at(8, 9)]);
  });

  test("keeps adjacent issues and drops overlapping ones", () => {
    expect(dropOverlaps([at(0, 3), at(3, 5), at(4, 6), at(0, 3)])).toEqual([at(0, 3), at(3, 5)]);
  });
});
