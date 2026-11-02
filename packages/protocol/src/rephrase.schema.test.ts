import { describe, expect, test } from "bun:test";
import { ClientMessage, CoreMessage, ModelRephraseResponse, RephraseSegment } from "./index";

const request = {
  type: "rephrase.request",
  fieldId: "f1",
  version: 2,
  requestId: 7,
  text: "Hi. Yo.",
  caret: 1,
};

const tone = {
  type: "rephrase.tone",
  fieldId: "f1",
  version: 2,
  requestId: 7,
  passage: { start: 0, end: 7 },
  sentences: [
    { text: "Hi.", start: 0, end: 3 },
    { text: "Yo.", start: 4, end: 7 },
  ],
  language: "en",
  tone: "concise",
  segments: [
    { from: 0, to: 0, keep: true },
    { from: 1, to: 1, text: "Hey." },
  ],
};

const done = { type: "rephrase.done", fieldId: "f1", version: 2, requestId: 7, count: 3 };

describe("rephrase.request", () => {
  test("accepts a request with a caret and a request id", () => {
    expect(ClientMessage.safeParse(request).success).toBe(true);
  });

  test("rejects a missing or negative caret, or no request id", () => {
    const { caret: _caret, ...noCaret } = request;
    const { requestId: _id, ...noId } = request;
    expect(ClientMessage.safeParse(noCaret).success).toBe(false);
    expect(ClientMessage.safeParse({ ...request, caret: -1 }).success).toBe(false);
    expect(ClientMessage.safeParse(noId).success).toBe(false);
  });

  test("a cancel names the field only", () => {
    expect(ClientMessage.safeParse({ type: "rephrase.cancel", fieldId: "f1" }).success).toBe(true);
    expect(ClientMessage.safeParse({ type: "rephrase.cancel", fieldId: "" }).success).toBe(false);
  });
});

describe("rephrase.tone", () => {
  test("accepts one tone with kept and rewritten segments", () => {
    expect(CoreMessage.safeParse(tone).success).toBe(true);
  });

  test("rejects an unknown tone, an unknown language, no segments or no request id", () => {
    const { requestId: _id, ...noId } = tone;
    expect(CoreMessage.safeParse({ ...tone, tone: "angry" }).success).toBe(false);
    expect(CoreMessage.safeParse({ ...tone, language: "de" }).success).toBe(false);
    expect(CoreMessage.safeParse({ ...tone, segments: [] }).success).toBe(false);
    expect(CoreMessage.safeParse(noId).success).toBe(false);
  });

  test("rejects an empty passage", () => {
    expect(CoreMessage.safeParse({ ...tone, passage: { start: 3, end: 3 } }).success).toBe(false);
  });
});

describe("rephrase.done", () => {
  test("ends a request that sent at least one tone", () => {
    expect(CoreMessage.safeParse(done).success).toBe(true);
    expect(CoreMessage.safeParse({ ...done, count: 0 }).success).toBe(false);
  });

  test("a rephrase error is tagged, with its request id, so it isn't read as a failed check", () => {
    const error = {
      type: "error",
      code: "rephrase_no_sentence",
      fieldId: "f1",
      request: "rephrase",
      requestId: 7,
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
  test("one tone's segments, with the language read loosely", () => {
    const reply = ModelRephraseResponse.parse({ language: "French", segments: [] });
    expect(reply.language).toBe("fr");
    expect(ModelRephraseResponse.parse({ segments: [] }).language).toBe("en");
  });

  test("a reply without segments is not the expected shape", () => {
    expect(ModelRephraseResponse.safeParse({ language: "en" }).success).toBe(false);
    expect(ModelRephraseResponse.safeParse({ versions: [] }).success).toBe(false);
  });
});
