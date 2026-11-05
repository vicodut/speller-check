import { describe, expect, test } from "bun:test";
import type { TextChangedMessage } from "@gc/protocol";
import { SentTexts } from "./sent-texts.store";

const changed = (version: number, text: string, fieldId = "f"): TextChangedMessage => ({
  type: "text.changed",
  fieldId,
  version,
  text,
});

const long = "The quick brown fox jumps over the lazy dog.";

describe("SentTexts", () => {
  test("the first send of a field is the full text", () => {
    expect(new SentTexts().encode(changed(1, long), false)).toEqual(changed(1, long));
  });

  test("a later change is an edit against the last sent version", () => {
    const sent = new SentTexts();
    sent.encode(changed(1, long), false);
    expect(sent.encode(changed(2, `${long}!`), false)).toEqual({
      type: "text.edit",
      fieldId: "f",
      version: 2,
      baseVersion: 1,
      start: long.length,
      deleteCount: 0,
      insert: "!",
    });
    expect(sent.encode(changed(3, `${long}!?`), false)).toMatchObject({ baseVersion: 2 });
  });

  test("a full send is forced on request (focus, resend)", () => {
    const sent = new SentTexts();
    sent.encode(changed(1, long), false);
    expect(sent.encode(changed(2, `${long}!`), true)).toEqual(changed(2, `${long}!`));
    expect(sent.encode(changed(3, `${long}!!`), false)).toMatchObject({ baseVersion: 2 });
  });

  test("an edit not smaller than the full text sends the full text", () => {
    const sent = new SentTexts();
    sent.encode(changed(1, "abc"), false);
    expect(sent.encode(changed(2, "xyz"), false)).toEqual(changed(2, "xyz"));
    expect(sent.encode(changed(3, ""), false)).toEqual(changed(3, ""));
  });

  test("forget and reset make the next send full", () => {
    const sent = new SentTexts();
    sent.encode(changed(1, long, "a"), false);
    sent.encode(changed(1, long, "b"), false);
    sent.forget("a");
    expect(sent.encode(changed(2, `${long}.`, "a"), false).type).toBe("text.changed");
    expect(sent.encode(changed(2, `${long}.`, "b"), false).type).toBe("text.edit");
    sent.reset();
    expect(sent.encode(changed(3, `${long}..`, "b"), false).type).toBe("text.changed");
  });

  test("keeps a bounded number of fields", () => {
    const sent = new SentTexts(2);
    for (const id of ["a", "b", "c"]) sent.encode(changed(1, long, id), false);
    expect(sent.encode(changed(2, `${long}.`, "a"), false).type).toBe("text.changed");
    expect(sent.encode(changed(2, `${long}.`, "c"), false).type).toBe("text.edit");
  });
});
