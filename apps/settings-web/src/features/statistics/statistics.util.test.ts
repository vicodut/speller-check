import { describe, expect, test } from "bun:test";
import { cellCounts, formatMsPerLetter, hasSamples, placeTag } from "./statistics.util";

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

describe("hasSamples", () => {
  test("false for a feature the profile never ran, so the page says No samples", () => {
    expect(hasSamples({ msPerLetter: null, okCount: 0, failureCount: 0, letters: 0 })).toBe(false);
  });

  test("true when there is at least one ok or failed call", () => {
    expect(hasSamples({ msPerLetter: null, okCount: 0, failureCount: 1, letters: 0 })).toBe(true);
    expect(hasSamples({ msPerLetter: null, okCount: 2, failureCount: 0, letters: 90 })).toBe(true);
  });
});
