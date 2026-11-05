import { describe, expect, test } from "bun:test";
import { diffText } from "./text-diff.util";

/** Applies a diff the way the core does, to check it round-trips. */
const apply = (prev: string, d: ReturnType<typeof diffText>) =>
  prev.slice(0, d.start) + d.insert + prev.slice(d.start + d.deleteCount);

describe("diffText", () => {
  test("a typed character is one insert", () => {
    expect(diffText("Helo world", "Hello world")).toEqual({
      start: 3,
      deleteCount: 0,
      insert: "l",
    });
  });

  test("a deletion, an append and a replacement", () => {
    expect(diffText("Hello world", "Hello")).toEqual({ start: 5, deleteCount: 6, insert: "" });
    expect(diffText("Hi", "Hi there")).toEqual({ start: 2, deleteCount: 0, insert: " there" });
    expect(diffText("a cat sat", "a dog sat")).toEqual({
      start: 2,
      deleteCount: 3,
      insert: "dog",
    });
  });

  test("identical texts give an empty edit", () => {
    expect(diffText("same", "same")).toEqual({ start: 4, deleteCount: 0, insert: "" });
  });

  test("from and to an empty text", () => {
    expect(diffText("", "abc")).toEqual({ start: 0, deleteCount: 0, insert: "abc" });
    expect(diffText("abc", "")).toEqual({ start: 0, deleteCount: 3, insert: "" });
  });

  test("prefix and suffix never overlap on repeated characters", () => {
    expect(diffText("aaa", "aaaa")).toEqual({ start: 3, deleteCount: 0, insert: "a" });
    expect(diffText("abab", "ab")).toEqual({ start: 2, deleteCount: 2, insert: "" });
  });

  test("never splits a surrogate pair", () => {
    const d = diffText("x😀y", "x😁y");
    expect(d).toEqual({ start: 1, deleteCount: 2, insert: "😁" });
  });

  test("round-trips", () => {
    const pairs = [
      ["Le chat est noir.", "Le chien est noir."],
      ["", ""],
      ["abc", "xabcx"],
      ["😀😀", "😀😁😀"],
      ["line\nbreak", "line\n\nbreak"],
    ];
    for (const [prev = "", next = ""] of pairs)
      expect(apply(prev, diffText(prev, next))).toBe(next);
  });
});
