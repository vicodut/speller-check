import { describe, expect, test } from "bun:test";
import { type FieldTraits, isWatchableField } from "./field-eligibility.policy";

const traits = (overrides: Partial<FieldTraits>): FieldTraits => ({
  tagName: "INPUT",
  type: null,
  readOnly: false,
  disabled: false,
  ...overrides,
});

describe("isWatchableField", () => {
  test("accepts textareas", () => {
    expect(isWatchableField(traits({ tagName: "TEXTAREA" }))).toBe(true);
  });

  test("accepts text-like inputs and inputs without a type", () => {
    for (const type of [null, "", "text", "search", "email", "url", "TEXT", " Search "]) {
      expect(isWatchableField(traits({ type }))).toBe(true);
    }
  });

  test("never accepts password inputs", () => {
    expect(isWatchableField(traits({ type: "password" }))).toBe(false);
    expect(isWatchableField(traits({ type: "PASSWORD" }))).toBe(false);
  });

  test("rejects every other input type", () => {
    for (const type of ["number", "tel", "hidden", "checkbox", "date", "file", "unknown"]) {
      expect(isWatchableField(traits({ type }))).toBe(false);
    }
  });

  test("rejects read-only and disabled fields", () => {
    expect(isWatchableField(traits({ readOnly: true }))).toBe(false);
    expect(isWatchableField(traits({ tagName: "TEXTAREA", disabled: true }))).toBe(false);
  });

  test("rejects other elements", () => {
    expect(isWatchableField(traits({ tagName: "DIV" }))).toBe(false);
    expect(isWatchableField(traits({ tagName: "SELECT" }))).toBe(false);
  });
});
