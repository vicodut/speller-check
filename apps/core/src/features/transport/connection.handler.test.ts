import { describe, expect, test } from "bun:test";
import type { CheckRequest, CoreMessage } from "@gc/protocol";
import { appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok } from "../../shared/result";
import { ConnectionHandler } from "./connection.handler";
import type { ServerDeps } from "./server-deps.types";

const TOKEN = "t".repeat(43);
const hello = JSON.stringify({ type: "hello", token: TOKEN });

const setup = (overrides: Partial<ServerDeps> = {}, helloTimeoutMs = 5000) => {
  const sent: CoreMessage[] = [];
  const closes: number[] = [];
  const updates: CheckRequest[] = [];
  const closedFields: string[] = [];
  const logs: string[] = [];
  let disposed = 0;
  let publish: ((message: CoreMessage) => void) | undefined;
  const deps: ServerDeps = {
    createSession: (p) => {
      publish = p;
      return {
        update: (request) => updates.push(request),
        close: (fieldId) => closedFields.push(fieldId),
        dispose: () => disposed++,
      };
    },
    addDictionaryTerm: async () => ok(undefined),
    ...overrides,
  };
  const socket = {
    send: (m: CoreMessage) => sent.push(m),
    close: (code: number) => closes.push(code),
  };
  const logger = new Logger((line) => logs.push(line));
  const handler = new ConnectionHandler({ token: TOKEN, helloTimeoutMs }, deps, socket, logger);
  return {
    handler,
    sent,
    closes,
    updates,
    closedFields,
    logs,
    disposed: () => disposed,
    publish: (m: CoreMessage) => publish?.(m),
  };
};

describe("ConnectionHandler", () => {
  test("answers a valid hello with ready", async () => {
    const t = setup();
    await t.handler.receive(hello);
    expect(t.sent).toEqual([{ type: "ready" }]);
    expect(t.closes).toEqual([]);
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
});
