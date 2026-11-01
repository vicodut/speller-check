import { describe, expect, test } from "bun:test";
import { trimEchoedContext } from "./suggestion-trimmer.service";

const trim = (sentence: string, original: string, suggestion: string): string => {
  const start = sentence.indexOf(original);
  return trimEchoedContext(sentence, start, start + original.length, suggestion);
};

describe("trimEchoedContext", () => {
  test("drops a leading word the suggestion repeats from just before the original", () => {
    expect(trim("I has went to the store.", "has went", "I went")).toBe("went");
  });

  test("drops several repeated leading words", () => {
    expect(trim("Yesterday we has gone home.", "has gone", "Yesterday we went")).toBe("went");
  });

  test("drops trailing words the suggestion repeats from just after the original", () => {
    expect(trim("Their going to the park.", "Their", "They're going")).toBe("They're");
  });

  test("keeps suggestions that don't echo their surroundings", () => {
    expect(trim("I has went to the store.", "has went", "went")).toBe("went");
    expect(trim("She don't like it.", "don't", "doesn't")).toBe("doesn't");
  });

  test("never trims the whole suggestion away", () => {
    expect(trim("I I went.", "I", "I")).toBe("I");
  });

  test("only trims whole words", () => {
    expect(trim("Fine. She go home.", "go", "goes")).toBe("goes");
    expect(trim("an apple", "apple", "an apples")).toBe("apples");
    expect(trim("bean apple", "apple", "an apples")).toBe("an apples");
  });
});
