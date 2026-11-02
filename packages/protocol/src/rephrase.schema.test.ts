import { describe, expect, test } from "bun:test";
import {
  ClientMessage,
  CoreMessage,
  ModelRephraseResponse,
  ModelRephraseVersion,
  RephraseSegment,
} from "./index";

const request = { type: "rephrase.request", fieldId: "f1", version: 2, text: "Hi. Yo.", caret: 1 };

const result = {
  type: "rephrase.result",
  fieldId: "f1",
  version: 2,
  passage: { start: 0, end: 7 },
  sentences: [
    { text: "Hi.", start: 0, end: 3 },
    { text: "Yo.", start: 4, end: 7 },
  ],
  language: "en",
  versions: [
    { tone: "professional", segments: [{ from: 0, to: 1, text: "Hello there." }] },
    {
      tone: "concise",
      segments: [
        { from: 0, to: 0, keep: true },
        { from: 1, to: 1, text: "Hey." },
      ],
    },
  ],
};

describe("rephrase.request", () => {
  test("accepts a request with a caret", () => {
    expect(ClientMessage.safeParse(request).success).toBe(true);
  });

  test("rejects a missing or negative caret", () => {
    const { caret: _caret, ...noCaret } = request;
    expect(ClientMessage.safeParse(noCaret).success).toBe(false);
    expect(ClientMessage.safeParse({ ...request, caret: -1 }).success).toBe(false);
  });
});

describe("rephrase.result", () => {
  test("accepts a result with kept and rewritten segments", () => {
    expect(CoreMessage.safeParse(result).success).toBe(true);
  });

  test("rejects an unknown tone, an unknown language and no versions", () => {
    const tone = {
      ...result,
      versions: [{ tone: "angry", segments: [{ from: 0, to: 1, keep: true }] }],
    };
    expect(CoreMessage.safeParse(tone).success).toBe(false);
    expect(CoreMessage.safeParse({ ...result, language: "de" }).success).toBe(false);
    expect(CoreMessage.safeParse({ ...result, versions: [] }).success).toBe(false);
  });

  test("rejects an empty passage", () => {
    expect(CoreMessage.safeParse({ ...result, passage: { start: 3, end: 3 } }).success).toBe(false);
  });

  test("a rephrase error is tagged so it isn't read as a failed check", () => {
    const error = {
      type: "error",
      code: "rephrase_no_sentence",
      fieldId: "f1",
      request: "rephrase",
    };
    expect(CoreMessage.safeParse(error).success).toBe(true);
    expect(CoreMessage.safeParse({ ...error, request: "check" }).success).toBe(false);
  });
});

describe("RephraseSegment", () => {
  test("rejects blank rewrites and backwards runs", () => {
    expect(RephraseSegment.safeParse({ from: 0, to: 0, text: "  " }).success).toBe(false);
    expect(RephraseSegment.safeParse({ from: 2, to: 1, keep: true }).success).toBe(false);
  });
});

describe("Model rephrase output", () => {
  test("accepts the prompt's shape and reads the language loosely", () => {
    const reply = ModelRephraseResponse.parse({ language: "French", versions: [] });
    expect(reply.language).toBe("fr");
    expect(ModelRephraseResponse.parse({ versions: [] }).language).toBe("en");
  });

  test("a version holds kept and rewritten segments by sentence number", () => {
    const version = {
      tone: "casual",
      segments: [
        { sentences: [1, 2], text: "Hey." },
        { sentences: [3], keep: true },
      ],
    };
    expect(ModelRephraseVersion.safeParse(version).success).toBe(true);
    const zero = { tone: "casual", segments: [{ sentences: [0], keep: true }] };
    expect(ModelRephraseVersion.safeParse(zero).success).toBe(false);
  });
});
