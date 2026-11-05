import { describe, expect, test } from "bun:test";
import { MAX_TEXT_LENGTH } from "@gc/protocol";
import { hello, setup } from "./connection-handler.fixture";

const changed = (version: number, text: string, fieldId = "f") =>
  JSON.stringify({ type: "text.changed", fieldId, version, text });

const edit = (version: number, baseVersion: number, start: number, del: number, insert: string) =>
  JSON.stringify({
    type: "text.edit",
    fieldId: "f",
    version,
    baseVersion,
    start,
    deleteCount: del,
    insert,
  });

const resync = { type: "error" as const, code: "resync_needed", fieldId: "f" };

describe("ConnectionHandler text.edit", () => {
  test("rebuilds the text and routes it like text.changed", async () => {
    const t = setup();
    await t.handler.receive(hello);
    await t.handler.receive(changed(1, "Helo world."));
    await t.handler.receive(edit(2, 1, 3, 0, "l"));
    await t.handler.receive(edit(3, 2, 6, 5, "there"));
    expect(t.updates).toEqual([
      { fieldId: "f", version: 1, text: "Helo world." },
      { fieldId: "f", version: 2, text: "Hello world." },
      { fieldId: "f", version: 3, text: "Hello there." },
    ]);
    expect(t.rephraseCalls).toEqual(["edited f", "edited f", "edited f"]);
    expect(t.sent).toEqual([{ type: "ready" }]);
    t.handler.dispose();
  });

  test("asks for a resync on an unknown field, a wrong base or an out-of-range edit", async () => {
    const t = setup();
    await t.handler.receive(hello);
    await t.handler.receive(edit(2, 1, 0, 0, "x"));
    await t.handler.receive(changed(3, "abc"));
    await t.handler.receive(edit(5, 4, 0, 0, "x"));
    await t.handler.receive(edit(4, 3, 2, 5, "x"));
    expect(t.sent).toEqual([{ type: "ready" }, resync, resync, resync]);
    expect(t.updates).toEqual([{ fieldId: "f", version: 3, text: "abc" }]);
    expect(t.logs.filter((l) => l.includes("text.resync_needed"))).toHaveLength(3);
    t.handler.dispose();
  });

  test("after a resync the full text is the new base", async () => {
    const t = setup();
    await t.handler.receive(hello);
    await t.handler.receive(edit(2, 1, 0, 0, "x"));
    await t.handler.receive(changed(3, "abc"));
    await t.handler.receive(edit(4, 3, 3, 0, "d"));
    expect(t.updates.at(-1)).toEqual({ fieldId: "f", version: 4, text: "abcd" });
    t.handler.dispose();
  });

  test("field.closed drops the stored text", async () => {
    const t = setup();
    await t.handler.receive(hello);
    await t.handler.receive(changed(1, "abc"));
    await t.handler.receive(JSON.stringify({ type: "field.closed", fieldId: "f" }));
    await t.handler.receive(edit(2, 1, 0, 0, "x"));
    expect(t.sent.at(-1)).toEqual(resync);
    expect(t.updates).toHaveLength(1);
    t.handler.dispose();
  });

  test("refuses a rebuilt text over the cap with text_too_long, before any check", async () => {
    const t = setup();
    await t.handler.receive(hello);
    await t.handler.receive(changed(1, "a".repeat(MAX_TEXT_LENGTH)));
    await t.handler.receive(edit(2, 1, 0, 0, "Secret"));
    expect(t.sent.at(-1)).toEqual({ type: "error", code: "text_too_long", fieldId: "f" });
    expect(t.updates).toHaveLength(1);
    await t.handler.receive(edit(3, 2, 0, 6, ""));
    expect(t.sent.at(-1)).toEqual(resync);
    t.handler.dispose();
  });

  test("logs lengths and codes only, never the text", async () => {
    const t = setup();
    await t.handler.receive(hello);
    await t.handler.receive(changed(1, "Secret words"));
    await t.handler.receive(edit(2, 1, 0, 0, "Hidden "));
    await t.handler.receive(edit(9, 8, 0, 0, "Hidden "));
    const logs = t.logs.join("\n");
    expect(logs).not.toContain("Secret");
    expect(logs).not.toContain("Hidden");
    expect(t.logs.some((l) => l.includes('"text.edit_applied","len":19'))).toBe(true);
    t.handler.dispose();
  });
});
