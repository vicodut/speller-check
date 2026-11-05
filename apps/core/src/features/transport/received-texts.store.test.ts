import { describe, expect, test } from "bun:test";
import { ReceivedTexts } from "./received-texts.store";

const edit = (fieldId: string, version: number, baseVersion: number, insert: string) => ({
  fieldId,
  version,
  baseVersion,
  start: 0,
  deleteCount: 0,
  insert,
});

describe("ReceivedTexts", () => {
  test("rebuilds a field's text from an edit against its last received version", () => {
    const texts = new ReceivedTexts();
    texts.received("f1", 1, "world");
    expect(texts.applyEdit(edit("f1", 2, 1, "Hello "))).toBe("Hello world");
    expect(texts.applyEdit(edit("f1", 3, 2, ">"))).toBe(">Hello world");
  });

  test("an unknown field needs a resync", () => {
    expect(new ReceivedTexts().applyEdit(edit("f1", 2, 1, "x"))).toBeUndefined();
  });

  test("a mismatched edit leaves the stored text alone", () => {
    const texts = new ReceivedTexts();
    texts.received("f1", 1, "a");
    expect(texts.applyEdit(edit("f1", 3, 2, "x"))).toBeUndefined();
    expect(texts.applyEdit(edit("f1", 2, 1, "b"))).toBe("ba");
  });

  test("an older full text is ignored, like the field session ignores it", () => {
    const texts = new ReceivedTexts();
    texts.received("f1", 2, "new");
    texts.received("f1", 1, "old");
    expect(texts.applyEdit(edit("f1", 3, 2, "!"))).toBe("!new");
  });

  test("a full text replaces the base for later edits", () => {
    const texts = new ReceivedTexts();
    texts.received("f1", 1, "a");
    texts.received("f1", 2, "b");
    expect(texts.applyEdit(edit("f1", 3, 1, "x"))).toBeUndefined();
    expect(texts.applyEdit(edit("f1", 3, 2, "x"))).toBe("xb");
  });

  test("dropping a field forgets its text", () => {
    const texts = new ReceivedTexts();
    texts.received("f1", 1, "a");
    texts.received("f2", 1, "b");
    texts.drop("f1");
    expect(texts.applyEdit(edit("f1", 2, 1, "x"))).toBeUndefined();
    expect(texts.applyEdit(edit("f2", 2, 1, "x"))).toBe("xb");
  });
});
