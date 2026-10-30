import { describe, expect, test } from "bun:test";
import { Issue, ModelResponse } from "./index";

const issue = {
  original: "teh",
  suggestion: "the",
  reason: "Spelling",
  context: "fixed teh bug in",
  type: "spelling",
};

describe("ModelResponse", () => {
  test("accepts the spec example", () => {
    expect(ModelResponse.safeParse({ issues: [issue] }).success).toBe(true);
  });

  test("accepts an empty issue list", () => {
    expect(ModelResponse.safeParse({ issues: [] }).success).toBe(true);
  });

  test("rejects an unknown type", () => {
    expect(ModelResponse.safeParse({ issues: [{ ...issue, type: "style" }] }).success).toBe(false);
  });

  test("rejects an empty original", () => {
    expect(ModelResponse.safeParse({ issues: [{ ...issue, original: "" }] }).success).toBe(false);
  });
});

describe("Issue", () => {
  test("requires end after start", () => {
    expect(Issue.safeParse({ ...issue, start: 6, end: 9 }).success).toBe(true);
    expect(Issue.safeParse({ ...issue, start: 6, end: 6 }).success).toBe(false);
  });
});
