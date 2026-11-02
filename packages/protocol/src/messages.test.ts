import { describe, expect, test } from "bun:test";
import { ClientMessage, CoreMessage } from "./index";

describe("ClientMessage", () => {
  test("accepts each client message type", () => {
    const messages = [
      { type: "hello", token: "t" },
      { type: "text.changed", fieldId: "f1", version: 3, text: "Hello." },
      { type: "field.closed", fieldId: "f1" },
      { type: "dictionary.add", term: "NestJS" },
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
      { type: "settings.changed", model: "qwen3:8b", local: true },
    ];
    for (const message of messages) expect(CoreMessage.safeParse(message).success).toBe(true);
  });
});
