import { describe, expect, test } from "bun:test";
import { applyTextEdit } from "./text-edit.util";

const base = { version: 3, text: "Hello world." };
const edit = (start: number, deleteCount: number, insert: string, baseVersion = 3) => ({
  version: 4,
  baseVersion,
  start,
  deleteCount,
  insert,
});

describe("applyTextEdit", () => {
  test("replaces deleteCount code units at start with insert", () => {
    expect(applyTextEdit(base, edit(6, 5, "there"))).toEqual({
      version: 4,
      text: "Hello there.",
    });
  });

  test("inserts, deletes, appends and clears", () => {
    expect(applyTextEdit(base, edit(5, 0, ","))?.text).toBe("Hello, world.");
    expect(applyTextEdit(base, edit(5, 6, ""))?.text).toBe("Hello.");
    expect(applyTextEdit(base, edit(12, 0, " Bye."))?.text).toBe("Hello world. Bye.");
    expect(applyTextEdit(base, edit(0, 12, ""))?.text).toBe("");
  });

  test("uses UTF-16 offsets", () => {
    const emoji = { version: 1, text: "a😀b" };
    expect(applyTextEdit(emoji, { ...edit(1, 2, "-"), baseVersion: 1 })?.text).toBe("a-b");
  });

  test("refuses an edit made against another version", () => {
    expect(applyTextEdit(base, edit(0, 0, "x", 2))).toBeUndefined();
    expect(applyTextEdit(base, edit(0, 0, "x", 4))).toBeUndefined();
  });

  test("refuses an edit outside the text", () => {
    expect(applyTextEdit(base, edit(13, 0, "x"))).toBeUndefined();
    expect(applyTextEdit(base, edit(10, 3, "x"))).toBeUndefined();
  });

  test("refuses a version that does not move forward", () => {
    expect(applyTextEdit(base, { ...edit(0, 0, "x"), version: 3 })).toBeUndefined();
  });
});
