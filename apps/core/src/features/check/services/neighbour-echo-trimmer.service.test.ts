import { describe, expect, test } from "bun:test";
import type { Issue } from "@gc/protocol";
import { trimNeighbourEchoes } from "./neighbour-echo-trimmer.service";

/** Builds an issue on the first occurrence of `original` at or after `from`. */
const on = (text: string, original: string, suggestion: string, from = 0): Issue => {
  const start = text.indexOf(original, from);
  return {
    original,
    suggestion,
    reason: "r",
    context: "c",
    type: "grammar",
    start,
    end: start + original.length,
  };
};

describe("trimNeighbourEchoes", () => {
  test("drops a suggestion that only re-adds the word a contraction already supplies", () => {
    const text = "Their going to the park.";
    const their = on(text, "Their", "They're");
    const going = on(text, "going", "are going");
    expect(trimNeighbourEchoes([their, going], text)).toEqual([their]);
  });

  test("matches words the previous suggestion spells out, case and apostrophes aside", () => {
    const text = "Its a nice day.";
    expect(
      trimNeighbourEchoes([on(text, "Its", "It is"), on(text, "a", "Is a")], text),
    ).toHaveLength(1);
    expect(
      trimNeighbourEchoes([on(text, "Its", "It’s"), on(text, "a", "is a")], text),
    ).toHaveLength(1);
    expect(
      trimNeighbourEchoes([on(text, "Its", "It's"), on(text, "a", "has a")], text),
    ).toHaveLength(1);
  });

  test("keeps the rest of the suggestion when it still fixes something", () => {
    const text = "Their goin to the park.";
    const their = on(text, "Their", "They're");
    const goin = on(text, "goin", "are going");
    expect(trimNeighbourEchoes([their, goin], text)).toEqual([
      their,
      { ...goin, suggestion: "going" },
    ]);
  });

  test("keeps independent fixes on neighbouring words", () => {
    const text = "She go store.";
    const issues = [on(text, "go", "goes"), on(text, "store", "to the store")];
    expect(trimNeighbourEchoes(issues, text)).toEqual(issues);
  });

  test("keeps issues that aren't separated by whitespace only", () => {
    const text = "Their, going to the park.";
    const issues = [on(text, "Their", "They're"), on(text, "going", "are going")];
    expect(trimNeighbourEchoes(issues, text)).toEqual(issues);
  });

  test("keeps a suggestion whose original already starts with the repeated word", () => {
    const text = "They are are going.";
    const issues = [on(text, "They", "They are"), on(text, "are are", "are")];
    expect(trimNeighbourEchoes(issues, text)).toEqual(issues);
  });

  test("compares against the previous kept issue only", () => {
    const text = "Their going going home.";
    const their = on(text, "Their", "They're");
    const first = on(text, "going", "are going");
    const second = on(text, "going", "are gone", first.end);
    expect(trimNeighbourEchoes([their, first, second], text)).toEqual([their, second]);
  });

  test("leaves a single issue or an empty list alone", () => {
    const text = "Their going.";
    expect(trimNeighbourEchoes([], text)).toEqual([]);
    expect(trimNeighbourEchoes([on(text, "going", "are going")], text)).toHaveLength(1);
  });
});
