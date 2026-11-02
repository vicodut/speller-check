import { describe, expect, test } from "bun:test";
import { MAX_TEXT_LENGTH } from "@gc/protocol";
import { canSendRephrase, messageForChange } from "./index";

const atCap = "a".repeat(MAX_TEXT_LENGTH);
const overCap = `${atCap}b`;

describe("messageForChange", () => {
  test("sends the text up to the cap", () => {
    expect(messageForChange({ fieldId: "f1", version: 1, text: atCap })).toEqual({
      type: "text.changed",
      fieldId: "f1",
      version: 1,
      text: atCap,
    });
  });

  test("sends no text over the cap, only field.closed", () => {
    const message = messageForChange({ fieldId: "f1", version: 2, text: overCap });
    expect(message).toEqual({ type: "field.closed", fieldId: "f1" });
    expect(JSON.stringify(message)).not.toContain("aaa");
  });

  test("resumes sending once the field is back under the cap", () => {
    const sent = [
      { fieldId: "f1", version: 1, text: "Short." },
      { fieldId: "f1", version: 2, text: overCap },
      { fieldId: "f1", version: 3, text: "Short again." },
    ].map(messageForChange);
    expect(sent.map((m) => m.type)).toEqual(["text.changed", "field.closed", "text.changed"]);
    expect(sent[2]).toMatchObject({ version: 3, text: "Short again." });
  });
});

describe("canSendRephrase", () => {
  const request = { type: "rephrase.request", fieldId: "f1", version: 1, requestId: 1, caret: 0 };

  test("refuses a rephrase of text over the cap", () => {
    expect(canSendRephrase({ ...request, type: "rephrase.request", text: atCap })).toBe(true);
    expect(canSendRephrase({ ...request, type: "rephrase.request", text: overCap })).toBe(false);
  });
});
