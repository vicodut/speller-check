import { describe, expect, test } from "bun:test";
import { lettersSent } from "./letters-sent.util";

describe("lettersSent", () => {
  test("no text sent counts zero letters", () => {
    expect(lettersSent([])).toBe(0);
  });

  test("one sentence counts every character of it, spaces and punctuation included", () => {
    expect(lettersSent(["I has went to the store."])).toBe(24);
    expect(lettersSent(["Hi, ok!"])).toBe(7);
  });

  test("several texts add up, as the target and context sentences of one call do", () => {
    expect(lettersSent(["I has went.", "Il a été là."])).toBe(12 + 11);
  });

  test("an accented French character is one character", () => {
    expect(lettersSent(["été"])).toBe(3);
  });

  test("an empty text adds nothing", () => {
    expect(lettersSent(["", "ok"])).toBe(2);
  });
});
