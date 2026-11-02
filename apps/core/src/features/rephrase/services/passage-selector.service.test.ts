import { describe, expect, test } from "bun:test";
import {
  MAX_PASSAGE_CHARS,
  MAX_PASSAGE_SENTENCES,
  selectPassage,
} from "./passage-selector.service";

const texts = (text: string, caret: number) =>
  selectPassage(text, caret)?.sentences.map((s) => s.text);

describe("selectPassage", () => {
  test("takes the whole paragraph holding the caret", () => {
    const text = "First one. Second one.\n\nThird one. Fourth one.\n\nFifth.";
    expect(texts(text, text.indexOf("Fourth"))).toEqual(["Third one.", "Fourth one."]);
    expect(texts(text, 0)).toEqual(["First one.", "Second one."]);
  });

  test("a single line break does not end the paragraph", () => {
    const text = "Hi Anna,\nThanks for this. See you.";
    expect(texts(text, text.length)).toEqual(["Hi Anna,", "Thanks for this.", "See you."]);
  });

  test("a blank line holding spaces still ends the paragraph", () => {
    const text = "One.\n  \nTwo.";
    expect(texts(text, text.length)).toEqual(["Two."]);
  });

  test("the caret counts at either end of a sentence", () => {
    const text = "Alpha. Beta.";
    expect(selectPassage(text, 0)).toBeDefined();
    expect(selectPassage(text, text.length)).toBeDefined();
  });

  test("returns the passage range and the sentences with field offsets", () => {
    const text = "Intro.\n\n  Hello there. How are you?";
    const passage = selectPassage(text, text.length - 2);
    expect(passage?.start).toBe(text.indexOf("Hello"));
    expect(passage?.end).toBe(text.length);
    for (const s of passage?.sentences ?? []) expect(text.slice(s.start, s.end)).toBe(s.text);
  });

  test("a caret outside any sentence gives no passage", () => {
    const text = "One.\n\n\n\nTwo.";
    expect(selectPassage(text, 6)).toBeUndefined();
    expect(selectPassage("", 0)).toBeUndefined();
    expect(selectPassage("   ", 1)).toBeUndefined();
    expect(selectPassage("One.", 99)).toBeUndefined();
  });

  test("caps a long paragraph to 8 sentences around the caret", () => {
    const text = Array.from({ length: 20 }, (_, i) => `Sentence ${i}.`).join(" ");
    const got = texts(text, text.indexOf("Sentence 10."));
    expect(got).toHaveLength(MAX_PASSAGE_SENTENCES);
    expect(got).toContain("Sentence 10.");
    expect(got?.[0]).toBe("Sentence 7.");
  });

  test("near the start of a long paragraph the window shifts forward", () => {
    const text = Array.from({ length: 20 }, (_, i) => `Sentence ${i}.`).join(" ");
    expect(texts(text, 0)?.at(-1)).toBe("Sentence 7.");
  });

  test("caps a long paragraph to 1,500 characters around the caret", () => {
    const long = `Word ${"word ".repeat(99)}end.`; // 504 characters: three pass 1,500
    const text = Array.from({ length: 6 }, () => long).join(" ");
    const passage = selectPassage(text, text.length - 1);
    expect(passage?.sentences).toHaveLength(2);
    expect((passage?.end ?? 0) - (passage?.start ?? 0)).toBeLessThanOrEqual(MAX_PASSAGE_CHARS);
  });

  test("a single sentence over the limit is still the passage", () => {
    const text = `${"word ".repeat(400)}end.`;
    expect(selectPassage(text, 10)?.sentences).toHaveLength(1);
  });
});
