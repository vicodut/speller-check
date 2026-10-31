import { describe, expect, test } from "bun:test";
import { parseModelResponse } from "./response-parser.service";

const issue = {
  original: "has went",
  suggestion: "went",
  reason: "Verb form",
  context: "I has went to",
  type: "grammar" as const,
};

describe("parseModelResponse", () => {
  test("parses a clean JSON reply", () => {
    expect(parseModelResponse(JSON.stringify({ issues: [issue] }))).toEqual({
      ok: true,
      value: [issue],
    });
  });

  test("parses an empty issue list", () => {
    expect(parseModelResponse('{"issues":[]}')).toEqual({ ok: true, value: [] });
  });

  test("tolerates code fences, prose and reasoning blocks", () => {
    const raw = `<think>hmm {not json}</think>Here you go:\n\`\`\`json\n${JSON.stringify({ issues: [issue] })}\n\`\`\``;
    expect(parseModelResponse(raw)).toEqual({ ok: true, value: [issue] });
  });

  test("accepts a bare array", () => {
    expect(parseModelResponse(JSON.stringify([issue]))).toEqual({ ok: true, value: [issue] });
  });

  test("drops individual issues that fail the schema", () => {
    const style = { ...issue, type: "style" };
    expect(parseModelResponse(JSON.stringify({ issues: [style, issue] }))).toEqual({
      ok: true,
      value: [issue],
    });
  });

  test("drops no-op issues whose suggestion equals the original", () => {
    const noop = { ...issue, original: "visité", suggestion: " visité " };
    expect(parseModelResponse(JSON.stringify({ issues: [noop, issue] }))).toEqual({
      ok: true,
      value: [issue],
    });
  });

  test.each([
    ["non-JSON", "Sorry, I can't help."],
    ["truncated JSON", '{"issues":[{"original":"a"'],
    ["wrong envelope", '{"errors":[]}'],
  ])("fails with model_invalid_json on %s", (_name, raw) => {
    expect(parseModelResponse(raw)).toEqual({ ok: false, error: { code: "model_invalid_json" } });
  });
});
