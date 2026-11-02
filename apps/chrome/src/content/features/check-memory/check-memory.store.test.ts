import { describe, expect, test } from "bun:test";
import type { Issue } from "@gc/protocol";
import { CheckMemoryStore, MAX_REMEMBERED_FIELDS } from "./check-memory.store";

const issue: Issue = {
  original: "teh",
  suggestion: "the",
  reason: "Spelling",
  context: "teh cat",
  type: "spelling",
  start: 0,
  end: 3,
};

describe("CheckMemoryStore", () => {
  test("remembers the result of the sent version with the text it was sent with", () => {
    const store = new CheckMemoryStore<object>();
    const field = {};
    store.sent(field, "f1", 2, "teh cat");
    expect(store.isPending("f1")).toBe(true);
    expect(store.received("f1", 2, [issue])).toBe(true);
    expect(store.isPending("f1")).toBe(false);
    expect(store.recall(field, "teh cat")).toEqual([issue]);
    expect(store.recall(field, "teh cats")).toBeUndefined();
    expect(store.recall({}, "teh cat")).toBeUndefined();
  });

  test("remembers a clean result as an empty list", () => {
    const store = new CheckMemoryStore<object>();
    const field = {};
    store.sent(field, "f1", 1, "Fine.");
    store.received("f1", 1, []);
    expect(store.recall(field, "Fine.")).toEqual([]);
  });

  test("ignores results for other versions or unknown fields", () => {
    const store = new CheckMemoryStore<object>();
    const field = {};
    store.sent(field, "f1", 1, "a");
    store.sent(field, "f1", 2, "b");
    expect(store.received("f1", 1, [issue])).toBe(false);
    expect(store.received("f9", 2, [issue])).toBe(false);
    expect(store.recall(field, "a")).toBeUndefined();
    expect(store.isPending("f1")).toBe(true);
  });

  test("a newer result replaces the field's older one", () => {
    const store = new CheckMemoryStore<object>();
    const field = {};
    store.sent(field, "f1", 1, "a");
    store.received("f1", 1, [issue]);
    store.sent(field, "f1", 2, "b");
    store.received("f1", 2, []);
    expect(store.recall(field, "a")).toBeUndefined();
    expect(store.recall(field, "b")).toEqual([]);
  });

  test("keeps only the most recently used fields", () => {
    const store = new CheckMemoryStore<object>();
    const fields = Array.from({ length: MAX_REMEMBERED_FIELDS + 1 }, () => ({}));
    fields.forEach((field, i) => {
      // Using the first field just before the limit is passed keeps it; the second goes.
      if (i === MAX_REMEMBERED_FIELDS) store.recall(fields[0] as object, "x");
      store.sent(field, `f${i}`, 1, "x");
      store.received(`f${i}`, 1, []);
    });
    expect(store.recall(fields[0] as object, "x")).toEqual([]);
    expect(store.recall(fields[1] as object, "x")).toBeUndefined();
    expect(store.recall(fields[MAX_REMEMBERED_FIELDS] as object, "x")).toEqual([]);
  });

  test("bounds pending checks too", () => {
    const store = new CheckMemoryStore<object>(2);
    store.sent({}, "f1", 1, "a");
    store.sent({}, "f2", 1, "b");
    store.sent({}, "f3", 1, "c");
    expect(store.isPending("f1")).toBe(false);
    expect(store.isPending("f3")).toBe(true);
  });

  test("forgets pending checks and all results on demand", () => {
    const store = new CheckMemoryStore<object>();
    const field = {};
    store.sent(field, "f1", 1, "a");
    store.received("f1", 1, [issue]);
    store.sent(field, "f1", 2, "b");
    store.dropPending("f1");
    expect(store.received("f1", 2, [])).toBe(false);
    store.forgetResults();
    expect(store.recall(field, "a")).toBeUndefined();
  });
});
