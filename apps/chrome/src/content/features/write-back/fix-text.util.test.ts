import { describe, expect, test } from "bun:test";
import { expectedTextAfterFix, issuesAfterFix, matchesText } from "./fix-text.util";

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

describe("issuesAfterFix", () => {
  const text = "I has went to teh store";
  const at = (original: string, suggestion: string) => {
    const start = text.indexOf(original);
    return { start, end: start + original.length, original, suggestion };
  };
  const has = at("has", "have");
  const teh = at("teh", "the");
  const went = at("went", "gone");

  test("drops the accepted issue and shifts the ones after it", () => {
    const after = issuesAfterFix([has, teh], has);
    const fixed = expectedTextAfterFix(text, has);
    expect(after).toEqual([{ ...teh, start: teh.start + 1, end: teh.end + 1 }]);
    expect(after.every((i) => matchesText(fixed, i))).toBe(true);
  });

  test("keeps issues before the fix where they are", () => {
    expect(issuesAfterFix([has, teh], teh)).toEqual([has]);
  });

  test("drops issues overlapping the fix", () => {
    const hasWent = at("has went", "went");
    expect(issuesAfterFix([hasWent, went, teh], hasWent)).toEqual([
      { ...teh, start: teh.start - 4, end: teh.end - 4 },
    ]);
  });
});
