import { describe, expect, test } from "bun:test";
import {
  type FieldClosedMessage,
  type Issue,
  type IssuesCoreMessage,
  MAX_TEXT_LENGTH,
  type TextChangedMessage,
} from "@gc/protocol";
import type { ConnectionStatus } from "../shared/port-messages";
import { MAX_REMEMBERED_FIELDS } from "./features/check-memory";
import { FieldChecks } from "./field-checks.service";
import type { WatchedField } from "./shared/issue-view";

const issue: Issue = {
  original: "teh",
  suggestion: "the",
  reason: "Spelling",
  context: "teh cat",
  type: "spelling",
  start: 0,
  end: 3,
};

const fakeField = (): WatchedField => ({}) as WatchedField;

/** A FieldChecks with recording fakes, driven like the field watcher drives it. */
const setup = (settleMs = 1000) => {
  const sent: (TextChangedMessage | FieldClosedMessage)[] = [];
  const shown: (readonly Issue[])[] = [];
  const badge: string[] = [];
  let status: ConnectionStatus | undefined = "ready";
  const checks = new FieldChecks({
    send: (message) => sent.push(message),
    view: { show: (_f, issues) => shown.push(issues), clear: () => badge.push("clear") },
    badge: {
      checking: () => badge.push("checking"),
      done: () => badge.push("done"),
      tooLong: () => badge.push("too_long"),
      offline: () => badge.push("offline"),
      failed: () => badge.push("failed"),
      hide: () => badge.push("hide"),
    },
    status: () => status,
    settleMs,
  });
  const versions = new Map<string, number>();
  const report = (field: WatchedField, fieldId: string, text: string, cause = "focus") => {
    const version = (versions.get(fieldId) ?? 0) + 1;
    versions.set(fieldId, version);
    checks.changed(field, fieldId, version, text, cause as "focus" | "input" | "resend");
    return version;
  };
  const answer = (fieldId: string, version: number, issues: Issue[]): IssuesCoreMessage => ({
    type: "issues",
    fieldId,
    version,
    issues,
  });
  const setStatus = (next: ConnectionStatus) => {
    status = next;
  };
  return { checks, sent, shown, badge, report, answer, setStatus };
};

const types = (sent: { type: string }[]) => sent.map((m) => m.type);

describe("FieldChecks", () => {
  test("refocus with unchanged text sends nothing and restores the issues", () => {
    const { checks, sent, shown, badge, report, answer } = setup();
    const field = fakeField();
    const v1 = report(field, "f1", "teh cat");
    checks.issues(answer("f1", v1, [issue]), field);
    checks.closed(field, "f1");
    sent.length = 0;
    shown.length = 0;
    badge.length = 0;
    report(field, "f1", "teh cat");
    expect(sent).toEqual([]);
    expect(shown).toEqual([[issue]]);
    expect(badge.at(-1)).toBe("done");
  });

  test("refocus after an edit made while unfocused checks again", () => {
    const { checks, sent, report, answer } = setup();
    const field = fakeField();
    const v1 = report(field, "f1", "teh cat");
    checks.issues(answer("f1", v1, [issue]), field);
    checks.closed(field, "f1");
    const v2 = report(field, "f1", "the cat");
    expect(sent.at(-1)).toEqual({
      type: "text.changed",
      fieldId: "f1",
      version: v2,
      text: "the cat",
    });
  });

  test("an edit or a resend always checks, even with the remembered text", () => {
    const { checks, sent, report, answer } = setup();
    const field = fakeField();
    const v1 = report(field, "f1", "teh cat");
    checks.issues(answer("f1", v1, [issue]), field);
    report(field, "f1", "teh cat", "input");
    report(field, "f1", "teh cat", "resend");
    expect(types(sent)).toEqual(["text.changed", "text.changed", "text.changed"]);
  });

  test("a field never checked is checked on focus", () => {
    const { sent, report } = setup();
    report(fakeField(), "f1", "Hello.");
    expect(types(sent)).toEqual(["text.changed"]);
  });

  test("a blur during a check waits for its result, remembers it, then closes", () => {
    const { checks, sent, shown, report, answer } = setup();
    const field = fakeField();
    const v1 = report(field, "f1", "teh cat");
    checks.closed(field, "f1");
    expect(types(sent)).toEqual(["text.changed"]);
    // The field is closed in the watcher, so the result comes without a field to draw on.
    checks.issues(answer("f1", v1, [issue]), undefined);
    expect(types(sent)).toEqual(["text.changed", "field.closed"]);
    expect(shown).toEqual([]);
    report(field, "f1", "teh cat");
    expect(types(sent)).toEqual(["text.changed", "field.closed"]);
    expect(shown).toEqual([[issue]]);
  });

  test("refocusing before the in-flight result cancels the deferred close", () => {
    const { checks, sent, report } = setup();
    const field = fakeField();
    report(field, "f1", "teh cat");
    checks.closed(field, "f1");
    report(field, "f1", "teh cat");
    checks.closed(field, "f1");
    expect(types(sent)).toEqual(["text.changed", "text.changed"]);
  });

  test("a deferred close is sent after the settle timeout, an error or a reconnect", async () => {
    const { checks, sent, report } = setup(5);
    const [a, b, c] = [fakeField(), fakeField(), fakeField()];
    report(a, "f1", "one");
    report(b, "f2", "two");
    report(c, "f3", "three");
    for (const [field, id] of [
      [a, "f1"],
      [b, "f2"],
      [c, "f3"],
    ] as const)
      checks.closed(field, id);
    checks.failed("f2", "model_failed", undefined);
    expect(sent.at(-1)).toEqual({ type: "field.closed", fieldId: "f2" });
    checks.coreReady();
    expect(sent.filter((m) => m.type === "field.closed").length).toBe(3);
    report(a, "f1", "one");
    checks.closed(a, "f1");
    await Bun.sleep(20);
    expect(sent.at(-1)).toEqual({ type: "field.closed", fieldId: "f1" });
  });

  test("a blur with nothing in flight closes at once", () => {
    const { checks, sent, report, answer } = setup();
    const field = fakeField();
    const v1 = report(field, "f1", "Fine.");
    checks.issues(answer("f1", v1, []), field);
    checks.closed(field, "f1");
    expect(types(sent)).toEqual(["text.changed", "field.closed"]);
  });

  test("a stale result is neither drawn nor remembered", () => {
    const { checks, shown, sent, report, answer } = setup();
    const field = fakeField();
    const v1 = report(field, "f1", "teh cat");
    report(field, "f1", "teh cats", "input");
    checks.issues(answer("f1", v1, [issue]), undefined);
    checks.closed(field, "f1");
    report(field, "f1", "teh cat");
    expect(shown).toEqual([]);
    expect(types(sent).at(-1)).toBe("text.changed");
  });

  test("a dictionary addition forgets remembered results", () => {
    const { checks, sent, report, answer } = setup();
    const field = fakeField();
    const v1 = report(field, "f1", "teh cat");
    checks.issues(answer("f1", v1, [issue]), field);
    checks.closed(field, "f1");
    checks.dictionaryChanged();
    report(field, "f1", "teh cat");
    expect(types(sent).at(-1)).toBe("text.changed");
  });

  test("an over-cap field still shows too long and sends no text", () => {
    const { sent, badge, report } = setup();
    report(fakeField(), "f1", "x".repeat(MAX_TEXT_LENGTH + 1));
    expect(sent).toEqual([{ type: "field.closed", fieldId: "f1" }]);
    expect(badge.at(-1)).toBe("too_long");
  });

  test("memory is bounded to the most recent fields", () => {
    const { checks, sent, report, answer } = setup();
    const fields = Array.from({ length: MAX_REMEMBERED_FIELDS + 1 }, fakeField);
    fields.forEach((field, i) => {
      const version = report(field, `f${i}`, "teh cat");
      checks.issues(answer(`f${i}`, version, [issue]), field);
      checks.closed(field, `f${i}`);
    });
    sent.length = 0;
    report(fields[MAX_REMEMBERED_FIELDS] as WatchedField, `f${MAX_REMEMBERED_FIELDS}`, "teh cat");
    expect(sent).toEqual([]);
    report(fields[0] as WatchedField, "f0", "teh cat");
    expect(types(sent)).toEqual(["text.changed"]);
  });

  test("offline status is shown instead of the spinner", () => {
    const { badge, report, setStatus } = setup();
    setStatus("unreachable");
    report(fakeField(), "f1", "Hello.");
    expect(badge.at(-1)).toBe("offline");
  });
});
