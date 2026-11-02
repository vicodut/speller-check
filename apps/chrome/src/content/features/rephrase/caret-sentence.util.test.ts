import { describe, expect, test } from "bun:test";
import { caretInSentence } from "./caret-sentence.util";

describe("caretInSentence", () => {
  test("is true inside a sentence and at either end", () => {
    const text = "Hello there. How are you?";
    expect(caretInSentence(text, 0)).toBe(true);
    expect(caretInSentence(text, 5)).toBe(true);
    expect(caretInSentence(text, text.length)).toBe(true);
    expect(caretInSentence(text, "Hello there.".length)).toBe(true);
  });

  test("is false on blank lines, in empty fields and without a caret", () => {
    const text = "One.\n\n\n\nTwo.";
    expect(caretInSentence(text, 6)).toBe(false);
    expect(caretInSentence("", 0)).toBe(false);
    expect(caretInSentence("   ", 2)).toBe(false);
    expect(caretInSentence("One.", null)).toBe(false);
  });
});
