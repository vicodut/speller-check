import { describe, expect, test } from "bun:test";
import { splitAtRange } from "./text-split.util";

describe("splitAtRange", () => {
  test("splits around the range", () => {
    expect(splitAtRange("I am teh one", 5, 8)).toEqual({
      before: "I am ",
      range: "teh",
      after: " one",
    });
  });

  test("handles a range at the start and end", () => {
    expect(splitAtRange("teh", 0, 3)).toEqual({ before: "", range: "teh", after: "" });
  });

  test("clamps offsets past the text", () => {
    expect(splitAtRange("abc", 2, 10)).toEqual({ before: "ab", range: "c", after: "" });
    expect(splitAtRange("abc", 5, 10)).toEqual({ before: "abc", range: "", after: "" });
  });

  test("pads a trailing newline so the last line keeps its height", () => {
    expect(splitAtRange("ab\n", 0, 1).after).toBe("b\n ");
  });
});
