import { describe, expect, test } from "bun:test";
import { diffTexts } from "./text-diff.service";

const rebuild = (before: string, after: string): string => {
  const edit = diffTexts(before, after);
  return (
    before.slice(0, edit.start) +
    after.slice(edit.start, edit.insertedEnd) +
    before.slice(edit.removedEnd)
  );
};

describe("diffTexts", () => {
  test("same texts give an empty edit at the end", () => {
    expect(diffTexts("abc", "abc")).toEqual({ start: 3, removedEnd: 3, insertedEnd: 3 });
  });

  test("insertion in the middle", () => {
    expect(diffTexts("I went", "I has went")).toEqual({ start: 2, removedEnd: 2, insertedEnd: 6 });
  });

  test("deletion", () => {
    expect(diffTexts("I has went", "I went")).toEqual({ start: 2, removedEnd: 6, insertedEnd: 2 });
  });

  test("replacement", () => {
    expect(diffTexts("fixed teh bug", "fixed the bug")).toEqual({
      start: 7,
      removedEnd: 9,
      insertedEnd: 9,
    });
  });

  test("append and prepend", () => {
    expect(diffTexts("abc", "abcd")).toEqual({ start: 3, removedEnd: 3, insertedEnd: 4 });
    expect(diffTexts("abc", "xabc")).toEqual({ start: 0, removedEnd: 0, insertedEnd: 1 });
  });

  test("empty texts", () => {
    expect(diffTexts("", "ab")).toEqual({ start: 0, removedEnd: 0, insertedEnd: 2 });
    expect(diffTexts("ab", "")).toEqual({ start: 0, removedEnd: 2, insertedEnd: 0 });
  });

  test("suffix never overlaps the prefix on repeated characters", () => {
    expect(diffTexts("aa", "aaa")).toEqual({ start: 2, removedEnd: 2, insertedEnd: 3 });
    expect(diffTexts("aaa", "aa")).toEqual({ start: 2, removedEnd: 3, insertedEnd: 2 });
  });

  test("does not split a surrogate pair in the prefix", () => {
    // Same high surrogate, different low surrogate.
    expect(diffTexts("a😀b", "a😁b")).toEqual({
      start: 1,
      removedEnd: 3,
      insertedEnd: 3,
    });
  });

  test("does not split a surrogate pair in the suffix", () => {
    // Different high surrogate, same low surrogate.
    expect(diffTexts("a🈀b", "a😀b")).toEqual({
      start: 1,
      removedEnd: 3,
      insertedEnd: 3,
    });
  });

  test("edit ranges rebuild the after text", () => {
    const cases: [string, string][] = [
      ["Hello world.", "Hello brave world."],
      ["\u{1F600}\u{1F600}", "\u{1F600}"],
      ["x\u{1F600}y", "x\u{1F600}\u{1F600}y"],
      ["a😀b", "a😁b"],
    ];
    for (const [before, after] of cases) expect(rebuild(before, after)).toBe(after);
  });
});
