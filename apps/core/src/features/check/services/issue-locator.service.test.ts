import { describe, expect, test } from "bun:test";
import type { ModelIssue } from "@gc/protocol";
import { locateIssue } from "./issue-locator.service";
import { segmentSentences } from "./sentence-segmenter.service";

const issue = (original: string, context: string, suggestion = "x"): ModelIssue => ({
  original,
  suggestion,
  reason: "r",
  context,
  type: "grammar",
});

const locate = (text: string, original: string, context: string) => {
  const result = locateIssue(issue(original, context), segmentSentences(text));
  return result.ok ? text.slice(result.value.start, result.value.end) : result.error.code;
};

const offsets = (text: string, original: string, context: string) => {
  const result = locateIssue(issue(original, context), segmentSentences(text));
  return result.ok ? [result.value.start, result.value.end] : result.error.code;
};

describe("locateIssue", () => {
  test("finds a unique original", () => {
    expect(offsets("I has went to the store.", "has went", "I has went to")).toEqual([2, 10]);
  });

  test("uses context to pick the right occurrence", () => {
    const text = "The cat sat. Their is a cat their.";
    expect(offsets(text, "their", "a cat their")).toEqual([28, 33]);
  });

  test("uses context across sentences", () => {
    const text = "I seen it. You seen it too.";
    expect(offsets(text, "seen", "You seen it")).toEqual([15, 19]);
  });

  test("falls back to a unique original when the context doesn't match", () => {
    expect(locate("Il sont partis hier.", "sont", "ils sont partis")).toBe("sont");
  });

  test("drops an original that is not in the text", () => {
    expect(locate("All good here.", "teh", "fixed teh bug")).toBe("issue_not_found");
  });

  test("drops an ambiguous original without usable context", () => {
    expect(locate("I saw their dog and their cat.", "their", "nowhere")).toBe("issue_ambiguous");
  });

  test("drops an original repeated inside its own context", () => {
    expect(locate("I saw the the the cat.", "the", "saw the the the cat")).toBe("issue_ambiguous");
  });

  test("matches whole words only", () => {
    expect(offsets("The theme is the best.", "the", "is the best")).toEqual([13, 16]);
    expect(locate("Thermal theory.", "the", "nowhere")).toBe("issue_not_found");
  });

  test("tolerates whitespace differences in context and original", () => {
    const text = "I  has \t went home.";
    expect(locate(text, "has went", "I has went home")).toBe("has \t went");
  });

  test("treats straight and curly apostrophes as equal", () => {
    expect(locate("L’enfant sont là.", "L'enfant sont", "L'enfant sont là")).toBe("L’enfant sont");
  });

  test("returns the source text as original and keeps the other fields", () => {
    const text = "L’enfant sont là.";
    const result = locateIssue(
      issue("L'enfant sont", "L'enfant sont", "L’enfant est"),
      segmentSentences(text),
    );
    expect(result.ok && result.value).toMatchObject({
      original: "L’enfant sont",
      suggestion: "L’enfant est",
    });
  });

  test("searches only the given sentences", () => {
    const [, second] = segmentSentences("I has it. You has it.");
    if (!second) throw new Error("expected two sentences");
    const result = locateIssue(issue("has", "nowhere"), [second]);
    expect(result.ok && [result.value.start, result.value.end]).toEqual([14, 17]);
  });

  test("returns UTF-16 offsets after emoji", () => {
    expect(offsets("👍 I has it.", "has", "I has it")).toEqual([5, 8]);
  });
});
