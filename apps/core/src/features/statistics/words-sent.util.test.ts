import { describe, expect, test } from "bun:test";
import { wordsSent } from "./words-sent.util";

describe("wordsSent", () => {
  test("no text sent counts zero words", () => {
    expect(wordsSent([])).toBe(0);
  });

  test("a word is a run of characters between whitespace", () => {
    expect(wordsSent(["I has went to the store."])).toBe(6);
    expect(wordsSent(["Il a été là."])).toBe(4);
  });

  test("runs of spaces, tabs and new lines add no words", () => {
    expect(wordsSent(["  a \n\t b  "])).toBe(2);
  });

  test("each text is counted on its own, so the end of one never joins the start of the next", () => {
    expect(wordsSent(["end.", "Next"])).toBe(2);
  });

  test("an empty text adds no words", () => {
    expect(wordsSent(["", "ok"])).toBe(1);
    expect(wordsSent(["   "])).toBe(0);
  });
});
