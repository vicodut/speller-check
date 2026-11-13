import { describe, expect, test } from "bun:test";
import {
  cellCounts,
  EMPTY_STATISTICS_TEXT,
  formatMsPerLetter,
  hasNoTimedCalls,
  placeTag,
} from "./statistics.util";

describe("formatMsPerLetter", () => {
  test("shows the median to one decimal place", () => {
    expect(formatMsPerLetter(4.8)).toBe("4.8 ms per letter");
    expect(formatMsPerLetter(15)).toBe("15.0 ms per letter");
  });

  test("says so when there are not enough samples for a median", () => {
    expect(formatMsPerLetter(null)).toBe("Not enough data");
  });
});

describe("cellCounts", () => {
  test("ok count, failure count and letters checked", () => {
    expect(cellCounts({ msPerLetter: null, okCount: 6, failureCount: 1, letters: 720 })).toBe(
      "6 ok · 1 failed · 720 letters",
    );
  });
});

describe("placeTag", () => {
  test("Local when the endpoint runs on this Mac, Cloud otherwise", () => {
    expect(placeTag(true)).toBe("Local");
    expect(placeTag(false)).toBe("Cloud");
  });
});

describe("empty statistics", () => {
  test("no rows at all is the empty state, and it says nothing has been timed yet", () => {
    expect(hasNoTimedCalls({ rows: [] })).toBe(true);
    expect(EMPTY_STATISTICS_TEXT).toMatch(/^Nothing has been timed yet\./);
  });

  test("any row means there is something to show", () => {
    const cell = { msPerLetter: null, okCount: 1, failureCount: 0, letters: 10 };
    const row = {
      profileId: "p1",
      profileName: "Local",
      model: "m",
      local: true,
      check: cell,
      rephrase: cell,
    };
    expect(hasNoTimedCalls({ rows: [row] })).toBe(false);
  });
});
