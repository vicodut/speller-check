import { describe, expect, test } from "bun:test";
import { MAX_TEXT_LENGTH } from "@gc/protocol";
import { appError } from "../../shared/errors";
import { err, ok } from "../../shared/result";
import { hello, setup } from "./connection-handler.fixture";

describe("ConnectionHandler", () => {
  test("answers a valid hello with ready", async () => {
    const t = setup();
    await t.handler.receive(hello);
    expect(t.sent).toEqual([{ type: "ready" }]);
    expect(t.closes).toEqual([]);
    t.handler.dispose();
  });

  test("sends the models in use with ready when the core can say", async () => {
    const check = { model: "m", local: false, provider: "openrouter.ai" };
    const rephrase = { model: "q", local: true, provider: "127.0.0.1" };
    const t = setup({ currentModels: async () => ({ check, rephrase }) });
    await t.handler.receive(hello);
    await Promise.resolve();
    expect(t.sent).toEqual([{ type: "ready", check, rephrase }]);
    t.handler.dispose();
  });

  test.each([
    ["wrong token", JSON.stringify({ type: "hello", token: "nope" })],
    ["another message first", JSON.stringify({ type: "field.closed", fieldId: "f" })],
    ["invalid JSON", "{"],
  ])("rejects %s with auth_failed and closes", async (_name, raw) => {
    const t = setup();
    await t.handler.receive(raw);
    expect(t.sent).toEqual([{ type: "error", code: "auth_failed" }]);
    expect(t.closes).toEqual([1008]);
    await t.handler.receive(hello);
    expect(t.sent).toHaveLength(1);
  });

  test("closes when no hello arrives in time", async () => {
    const t = setup({}, 10);
    await Bun.sleep(30);
    expect(t.sent).toEqual([{ type: "error", code: "auth_failed" }]);
    expect(t.closes).toEqual([1008]);
  });

  test("routes text.changed and field.closed, ignores a second hello", async () => {
    const t = setup();
    await t.handler.receive(hello);
    await t.handler.receive(hello);
    await t.handler.receive(
      JSON.stringify({ type: "text.changed", fieldId: "f", version: 2, text: "Hi" }),
    );
    await t.handler.receive(JSON.stringify({ type: "field.closed", fieldId: "f" }));
    expect(t.updates).toEqual([{ fieldId: "f", version: 2, text: "Hi" }]);
    expect(t.closedFields).toEqual(["f"]);
    expect(t.sent).toEqual([{ type: "ready" }]);
    t.handler.dispose();
  });

  test("ignores a ping: no reply, no routing, no log", async () => {
    const t = setup();
    await t.handler.receive(hello);
    const logsBefore = t.logs.length;
    await t.handler.receive(JSON.stringify({ type: "ping" }));
    expect(t.sent).toEqual([{ type: "ready" }]);
    expect(t.updates).toEqual([]);
    expect(t.rephraseCalls).toEqual([]);
    expect(t.logs).toHaveLength(logsBefore);
    t.handler.dispose();
  });

  test("answers an invalid message with message_invalid, without echoing or logging it", async () => {
    const t = setup();
    await t.handler.receive(hello);
    await t.handler.receive(JSON.stringify({ type: "text.changed", text: "secret words" }));
    expect(t.sent.at(-1)).toEqual({ type: "error", code: "message_invalid" });
    expect(t.logs.join("\n")).not.toContain("secret");
    expect(t.logs.some((line) => line.includes("message.invalid"))).toBe(true);
    t.handler.dispose();
  });

  test("adds dictionary terms and reports failures as error codes", async () => {
    const terms: string[] = [];
    const t = setup({
      addDictionaryTerm: async (term) => {
        terms.push(term);
        return term === "bad" ? err(appError("dictionary_write_failed")) : ok(undefined);
      },
    });
    await t.handler.receive(hello);
    await t.handler.receive(JSON.stringify({ type: "dictionary.add", term: "NestJS" }));
    await t.handler.receive(JSON.stringify({ type: "dictionary.add", term: "bad" }));
    expect(terms).toEqual(["NestJS", "bad"]);
    expect(t.sent).toEqual([{ type: "ready" }, { type: "error", code: "dictionary_write_failed" }]);
    t.handler.dispose();
  });

  test("publishes session messages until disposed, then disposes the session once", async () => {
    const t = setup();
    await t.handler.receive(hello);
    t.publish({ type: "issues", fieldId: "f", version: 1, issues: [] });
    t.handler.dispose();
    t.handler.dispose();
    t.publish({ type: "issues", fieldId: "f", version: 2, issues: [] });
    expect(t.sent).toEqual([
      { type: "ready" },
      { type: "issues", fieldId: "f", version: 1, issues: [] },
    ]);
    expect(t.disposed()).toBe(1);
  });

  test("routes rephrase requests, edits and cancels; a blur leaves the rephrase running", async () => {
    const t = setup();
    await t.handler.receive(hello);
    const request = { type: "rephrase.request", fieldId: "f", version: 4, requestId: 1 };
    await t.handler.receive(JSON.stringify({ ...request, text: "Hi.", caret: 0 }));
    await t.handler.receive(
      JSON.stringify({ type: "text.changed", fieldId: "f", version: 5, text: "Ho." }),
    );
    await t.handler.receive(JSON.stringify({ type: "field.closed", fieldId: "f" }));
    await t.handler.receive(JSON.stringify({ type: "rephrase.cancel", fieldId: "f" }));
    expect(t.rephraseCalls).toEqual(["request f 1", "edited f", "cancel f"]);
    t.handler.dispose();
    expect(t.rephraseCalls.at(-1)).toBe("dispose");
  });

  test("refuses a rephrase of text over the cap with text_too_long", async () => {
    const t = setup();
    await t.handler.receive(hello);
    const text = `Secret. ${"a".repeat(MAX_TEXT_LENGTH)}`;
    const request = { type: "rephrase.request", fieldId: "f", version: 1, requestId: 7, caret: 0 };
    await t.handler.receive(JSON.stringify({ ...request, text }));
    expect(t.rephraseCalls).toEqual([]);
    expect(t.sent.at(-1)).toEqual({
      type: "error",
      code: "text_too_long",
      fieldId: "f",
      request: "rephrase",
      requestId: 7,
    });
    expect(t.logs.join("\n")).not.toContain("Secret");
    t.handler.dispose();
  });

  test("rephrase replies go out on the socket", async () => {
    const t = setup();
    await t.handler.receive(hello);
    const error = {
      type: "error",
      code: "rephrase_cancelled",
      fieldId: "f",
      request: "rephrase",
      requestId: 1,
    } as const;
    t.publishRephrase(error);
    expect(t.sent.at(-1)).toEqual(error);
    t.handler.dispose();
  });
});
