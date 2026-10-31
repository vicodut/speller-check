import { describe, expect, test } from "bun:test";
import { expectedTextAfterFix, matchesText } from "./fix-text.util";

const teh = { start: 5, end: 8, original: "teh", suggestion: "the" };

describe("matchesText", () => {
  test("accepts a range that still holds the original", () => {
    expect(matchesText("I am teh one", teh)).toBe(true);
  });

  test("rejects a range whose text changed", () => {
    expect(matchesText("I am the one", teh)).toBe(false);
  });

  test("rejects a range past the end of the text", () => {
    expect(matchesText("I am", teh)).toBe(false);
  });
});

describe("expectedTextAfterFix", () => {
  test("replaces the range with the suggestion", () => {
    expect(expectedTextAfterFix("I am teh one", teh)).toBe("I am the one");
  });

  test("handles a deletion", () => {
    const fix = { start: 1, end: 3, original: ", ", suggestion: "" };
    expect(expectedTextAfterFix("a, b", fix)).toBe("ab");
  });

  test("uses UTF-16 offsets", () => {
    const fix = { start: 3, end: 6, original: "teh", suggestion: "the" };
    expect(expectedTextAfterFix("😀 teh", fix)).toBe("😀 the");
  });
});
