import { describe, expect, test } from "bun:test";
import {
  cellCounts,
  EMPTY_STATISTICS_TEXT,
  formatMsPerLetter,
  formatMsPerWord,
  hasNoTimedCalls,
  hasSamples,
  placeTag,
  rowTotals,
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

const emptyCell = {
  msPerLetter: null,
  msPerWord: null,
  okCount: 0,
  failureCount: 0,
  letters: 0,
  words: null,
};

describe("formatMsPerWord", () => {
  test("shows the median to one decimal place", () => {
    expect(formatMsPerWord(24)).toBe("24.0 ms per word");
    expect(formatMsPerWord(3.3)).toBe("3.3 ms per word");
  });

  test("says so when there are not enough samples with a word count", () => {
    expect(formatMsPerWord(null)).toBe("Not enough data");
  });
});

describe("rowTotals", () => {
  test("letters and words side by side", () => {
    expect(rowTotals({ letters: 720, words: 140 })).toBe("720 letters · 140 words");
  });

  test("no word count yet says so, rather than a zero", () => {
    expect(rowTotals({ letters: 30, words: null })).toBe("30 letters · words not counted");
  });
});

describe("cellCounts", () => {
  test("ok count, failure count and letters checked", () => {
    expect(
      cellCounts({
        msPerLetter: null,
        msPerWord: null,
        okCount: 6,
        failureCount: 1,
        letters: 720,
        words: 140,
      }),
    ).toBe("6 ok · 1 failed · 720 letters");
  });
});

describe("placeTag", () => {
  test("Local when the endpoint runs on this Mac, Cloud otherwise", () => {
    expect(placeTag(true)).toBe("Local");
    expect(placeTag(false)).toBe("Cloud");
  });
});

describe("hasSamples", () => {
  test("false for a feature the profile never ran, so the page says No samples", () => {
    expect(hasSamples(emptyCell)).toBe(false);
  });

  test("true when there is at least one ok or failed call", () => {
    expect(hasSamples({ ...emptyCell, failureCount: 1 })).toBe(true);
    expect(hasSamples({ ...emptyCell, okCount: 2, letters: 90, words: 12 })).toBe(true);
  });
});

describe("empty statistics", () => {
  test("no rows at all is the empty state, and it says nothing has been timed yet", () => {
    expect(hasNoTimedCalls({ rows: [] })).toBe(true);
    expect(EMPTY_STATISTICS_TEXT).toMatch(/^Nothing has been timed yet\./);
  });

  test("any row means there is something to show", () => {
    const cell = { ...emptyCell, okCount: 1, letters: 10, words: 2 };
    const row = {
      profileId: "p1",
      profileName: "Local",
      deleted: false,
      model: "m",
      local: true,
      letters: 10,
      words: 2,
      check: cell,
      rephrase: cell,
    };
    expect(hasNoTimedCalls({ rows: [row] })).toBe(false);
  });
});
