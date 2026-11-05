import { describe, expect, test } from "bun:test";
import { ClientMessage, CoreMessage } from "./index";

describe("ClientMessage", () => {
  test("accepts each client message type", () => {
    const messages = [
      { type: "hello", token: "t" },
      { type: "text.changed", fieldId: "f1", version: 3, text: "Hello." },
      { type: "field.closed", fieldId: "f1" },
      {
        type: "text.edit",
        fieldId: "f1",
        version: 4,
        baseVersion: 3,
        start: 2,
        deleteCount: 1,
        insert: "e",
      },
      { type: "dictionary.add", term: "NestJS" },
      { type: "ping" },
    ];
    for (const message of messages) expect(ClientMessage.safeParse(message).success).toBe(true);
  });

  test("rejects unknown types, negative versions and blank terms", () => {
    expect(ClientMessage.safeParse({ type: "check" }).success).toBe(false);
    expect(
      ClientMessage.safeParse({ type: "text.changed", fieldId: "f", version: -1, text: "" })
        .success,
    ).toBe(false);
    expect(ClientMessage.safeParse({ type: "dictionary.add", term: "  " }).success).toBe(false);
  });
});

describe("text.edit", () => {
  const edit = {
    type: "text.edit",
    fieldId: "f1",
    version: 4,
    baseVersion: 3,
    start: 0,
    deleteCount: 0,
    insert: "",
  };

  test("accepts an empty insert and a zero-length delete", () => {
    expect(ClientMessage.parse(edit)).toEqual(edit as ClientMessage);
  });

  test("rejects negative or fractional offsets and a missing insert", () => {
    for (const bad of [
      { ...edit, start: -1 },
      { ...edit, deleteCount: 1.5 },
      { ...edit, baseVersion: -1 },
      { ...edit, insert: undefined },
      { ...edit, fieldId: "" },
    ]) {
      expect(ClientMessage.safeParse(bad).success).toBe(false);
    }
  });
});

describe("CoreMessage", () => {
  test("issues accepts an optional boolean pending flag", () => {
    const issues = { type: "issues" as const, fieldId: "f1", version: 1, issues: [] };
    expect(CoreMessage.parse({ ...issues, pending: true })).toEqual({ ...issues, pending: true });
    expect(CoreMessage.parse(issues)).not.toHaveProperty("pending");
    expect(CoreMessage.safeParse({ ...issues, pending: "yes" }).success).toBe(false);
  });

  test("accepts ready, issues, error and settings.changed", () => {
    const messages = [
      { type: "ready" },
      { type: "issues", fieldId: "f1", version: 1, issues: [] },
      { type: "error", code: "provider_timeout", fieldId: "f1" },
      { type: "error", code: "resync_needed", fieldId: "f1" },
      { type: "settings.changed", model: "qwen3:8b", local: true },
    ];
    for (const message of messages) expect(CoreMessage.safeParse(message).success).toBe(true);
  });
});
