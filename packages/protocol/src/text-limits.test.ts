import { describe, expect, test } from "bun:test";
import { isTextTooLong, MAX_TEXT_LENGTH } from "./index";

describe("text length cap", () => {
  test("is 20,000 characters", () => {
    expect(MAX_TEXT_LENGTH).toBe(20_000);
  });

  test("allows text up to the cap and refuses anything longer", () => {
    expect(isTextTooLong("")).toBe(false);
    expect(isTextTooLong("a".repeat(MAX_TEXT_LENGTH))).toBe(false);
    expect(isTextTooLong("a".repeat(MAX_TEXT_LENGTH + 1))).toBe(true);
  });
});
