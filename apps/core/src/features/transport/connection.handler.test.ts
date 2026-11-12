import { describe, expect, test } from "bun:test";
import { MAX_TEXT_LENGTH } from "@gc/protocol";
import { appError } from "../../shared/errors";
import { err, ok } from "../../shared/result";
import { setup, TOKEN } from "./connection-handler.fixture";
import { proofFor } from "./handshake-client.fixture";

/** A valid proof, but for another connection's challenge. */
const replayedProof = (() => {
  const other = setup();
  other.handler.dispose();
  return other.proof;
})();

describe("ConnectionHandler", () => {
  test("opens with a fresh challenge, never the token", () => {
    const a = setup();
    const b = setup();
    expect(a.challenge.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(a.challenge.nonce).not.toBe(b.challenge.nonce);
    expect(JSON.stringify(a.challenge)).not.toContain(TOKEN);
    a.handler.dispose();
    b.handler.dispose();
  });

  test("answers a valid proof with ready and the core's proof", async () => {
    const t = setup();
    await t.handler.receive(t.proof);
    expect(t.sent).toEqual([t.ready]);
    expect(t.closes).toEqual([]);
    expect(t.logs.join("\n")).not.toContain(TOKEN);
    t.handler.dispose();
  });

  test("sends the models in use with ready when the core can say", async () => {
    const check = { model: "m", local: false, provider: "openrouter.ai" };
    const rephrase = { model: "q", local: true, provider: "127.0.0.1" };
    const t = setup({ currentModels: async () => ({ check, rephrase }) });
    await t.handler.receive(t.proof);
    await Promise.resolve();
    expect(t.sent).toEqual([{ ...t.ready, check, rephrase }]);
    t.handler.dispose();
  });

  test.each([
    ["a proof made with another token", proofFor("u".repeat(43), "a".repeat(64))],
    ["a proof replayed from another connection", replayedProof],
    ["a malformed proof", JSON.stringify({ type: "proof", nonce: "c".repeat(64), proof: "zz" })],
    ["another message first", JSON.stringify({ type: "field.closed", fieldId: "f" })],
    ["invalid JSON", "{"],
  ])("rejects %s with auth_failed and closes", async (_name, raw) => {
    const t = setup();
    await t.handler.receive(raw);
    expect(t.sent).toEqual([{ type: "error", code: "auth_failed" }]);
    expect(t.closes).toEqual([1008]);
    await t.handler.receive(t.proof);
    expect(t.sent).toHaveLength(1);
  });

  test("tells an extension that still sends hello to update, and closes", async () => {
    const t = setup();
    await t.handler.receive(JSON.stringify({ type: "hello", token: TOKEN }));
    expect(t.sent).toEqual([{ type: "error", code: "update_extension" }]);
    expect(t.closes).toEqual([1008]);
    expect(t.updates).toEqual([]);
  });

  test("closes when no proof arrives in time", async () => {
    const t = setup({}, 10);
    await Bun.sleep(30);
    expect(t.sent).toEqual([{ type: "error", code: "auth_failed" }]);
    expect(t.closes).toEqual([1008]);
  });

  test("routes text.changed and field.closed, ignores a second proof or hello", async () => {
    const t = setup();
    await t.handler.receive(t.proof);
    await t.handler.receive(t.proof);
    await t.handler.receive(JSON.stringify({ type: "hello", token: TOKEN }));
    await t.handler.receive(
      JSON.stringify({ type: "text.changed", fieldId: "f", version: 2, text: "Hi" }),
    );
    await t.handler.receive(JSON.stringify({ type: "field.closed", fieldId: "f" }));
    expect(t.updates).toEqual([{ fieldId: "f", version: 2, text: "Hi" }]);
    expect(t.closedFields).toEqual(["f"]);
    expect(t.sent).toEqual([t.ready]);
    t.handler.dispose();
  });

  test("ignores a ping: no reply, no routing, no log", async () => {
    const t = setup();
    await t.handler.receive(t.proof);
    const logsBefore = t.logs.length;
    await t.handler.receive(JSON.stringify({ type: "ping" }));
    expect(t.sent).toEqual([t.ready]);
    expect(t.updates).toEqual([]);
    expect(t.rephraseCalls).toEqual([]);
    expect(t.logs).toHaveLength(logsBefore);
    t.handler.dispose();
  });

  test("answers an invalid message with message_invalid, without echoing or logging it", async () => {
    const t = setup();
    await t.handler.receive(t.proof);
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
    await t.handler.receive(t.proof);
    await t.handler.receive(JSON.stringify({ type: "dictionary.add", term: "NestJS" }));
    await t.handler.receive(JSON.stringify({ type: "dictionary.add", term: "bad" }));
    expect(terms).toEqual(["NestJS", "bad"]);
    expect(t.sent).toEqual([t.ready, { type: "error", code: "dictionary_write_failed" }]);
    t.handler.dispose();
  });

  test("publishes session messages until disposed, then disposes the session once", async () => {
    const t = setup();
    await t.handler.receive(t.proof);
    t.publish({ type: "issues", fieldId: "f", version: 1, issues: [] });
    t.handler.dispose();
    t.handler.dispose();
    t.publish({ type: "issues", fieldId: "f", version: 2, issues: [] });
    expect(t.sent).toEqual([t.ready, { type: "issues", fieldId: "f", version: 1, issues: [] }]);
    expect(t.disposed()).toBe(1);
  });

  test("routes rephrase requests, edits and cancels; a blur leaves the rephrase running", async () => {
    const t = setup();
    await t.handler.receive(t.proof);
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
    await t.handler.receive(t.proof);
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
    await t.handler.receive(t.proof);
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
