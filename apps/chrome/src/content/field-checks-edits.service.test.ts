import { describe, expect, test } from "bun:test";
import type { FieldClosedMessage, TextChangedMessage, TextEditMessage } from "@gc/protocol";
import { FieldChecks } from "./field-checks.service";
import type { WatchedField } from "./shared/issue-view";

type Sent = TextChangedMessage | TextEditMessage | FieldClosedMessage;
type Cause = "focus" | "input" | "resend";

const text = "The quick brown fox jumps over the lazy dog.";

/** A FieldChecks with recording fakes, driven like the field watcher drives it. */
const setup = () => {
  const sent: Sent[] = [];
  const badge: string[] = [];
  const checks = new FieldChecks({
    send: (message) => sent.push(message),
    view: { show: () => {}, clear: () => badge.push("clear") },
    badge: {
      checking: () => badge.push("checking"),
      done: () => badge.push("done"),
      tooLong: () => badge.push("too_long"),
      offline: () => badge.push("offline"),
      failed: () => badge.push("failed"),
      hide: () => badge.push("hide"),
    },
    status: () => "ready",
    settleMs: 1000,
  });
  const field = {} as WatchedField;
  let version = 0;
  const report = (value: string, cause: Cause = "input") => {
    version += 1;
    checks.changed(field, "f1", version, value, cause);
    return version;
  };
  return { checks, sent, badge, field, report };
};

const types = (sent: Sent[]) => sent.map((m) => m.type);

describe("FieldChecks text edits", () => {
  test("focus sends the full text, typing sends edits against the last version", () => {
    const { sent, report } = setup();
    report(text, "focus");
    report(`${text}!`);
    expect(sent).toEqual([
      { type: "text.changed", fieldId: "f1", version: 1, text },
      {
        type: "text.edit",
        fieldId: "f1",
        version: 2,
        baseVersion: 1,
        start: text.length,
        deleteCount: 0,
        insert: "!",
      },
    ]);
  });

  test("a resync sends no failure and makes the next send full", () => {
    const { checks, sent, badge, field, report } = setup();
    report(text, "focus");
    report(`${text}!`);
    badge.length = 0;
    checks.resyncNeeded("f1", field);
    expect(badge).toEqual([]);
    // The session then resends the focused field as a new version.
    report(`${text}!`, "resend");
    report(`${text}!?`);
    expect(types(sent)).toEqual(["text.changed", "text.edit", "text.changed", "text.edit"]);
    expect(sent.at(-1)).toMatchObject({ baseVersion: 3 });
  });

  test("a resync for a blurred field releases its deferred close", () => {
    const { checks, sent, field, report } = setup();
    report(text, "focus");
    report(`${text}!`);
    checks.closed(field, "f1");
    expect(types(sent)).toEqual(["text.changed", "text.edit"]);
    checks.resyncNeeded("f1", undefined);
    expect(types(sent)).toEqual(["text.changed", "text.edit", "field.closed"]);
  });

  test("after a model change, the next send is full", () => {
    const { checks, sent, report } = setup();
    report(text, "focus");
    report(`${text}.`);
    checks.modelChanged();
    report(`${text}..`);
    expect(types(sent)).toEqual(["text.changed", "text.edit", "text.changed"]);
  });

  test("after field.closed, core.ready or going over the cap, the next send is full", () => {
    const { checks, sent, field, report } = setup();
    report(text, "focus");
    checks.closed(field, "f1");
    checks.issues({ type: "issues", fieldId: "f1", version: 1, issues: [] }, undefined);
    report(`${text}.`);
    checks.coreReady();
    report(`${text}..`);
    report("x".repeat(20_001));
    report(`${text}...`);
    expect(types(sent)).toEqual([
      "text.changed",
      "field.closed",
      "text.changed",
      "text.changed",
      "field.closed",
      "text.changed",
    ]);
  });
});
