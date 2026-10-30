import { describe, expect, test } from "bun:test";
import { segmentSentences } from "./sentence-segmenter.service";

const texts = (input: string) => segmentSentences(input).map((s) => s.text);

describe("segmentSentences", () => {
  test("splits English sentences", () => {
    expect(texts("I has went to the store. It were closed!")).toEqual([
      "I has went to the store.",
      "It were closed!",
    ]);
  });

  test("splits French sentences, including guillemets and ellipses", () => {
    expect(texts("Les enfants est partis. Il a dit « bonjour ». Et après… rien.")).toEqual([
      "Les enfants est partis.",
      "Il a dit « bonjour ».",
      "Et après… rien.",
    ]);
  });

  test("splits mixed English and French text", () => {
    expect(texts("This are wrong. Ceci est faux ? Yes.")).toEqual([
      "This are wrong.",
      "Ceci est faux ?",
      "Yes.",
    ]);
  });

  test("breaks on newlines", () => {
    expect(texts("Hello there\nSecond line")).toEqual(["Hello there", "Second line"]);
  });

  test("returns offsets that slice back to the trimmed sentence", () => {
    const input = "  First one.   Second one.  \n\n Third ";
    for (const sentence of segmentSentences(input)) {
      expect(input.slice(sentence.start, sentence.end)).toBe(sentence.text);
    }
    expect(texts(input)).toEqual(["First one.", "Second one.", "Third"]);
  });

  test("ignores empty and whitespace-only input", () => {
    expect(segmentSentences("")).toEqual([]);
    expect(segmentSentences("  \n ")).toEqual([]);
  });

  test("uses UTF-16 offsets around emoji", () => {
    const input = "Nice 👍. Next.";
    const [, second] = segmentSentences(input);
    expect(second).toEqual({ text: "Next.", start: 9, end: 14 });
  });
});
