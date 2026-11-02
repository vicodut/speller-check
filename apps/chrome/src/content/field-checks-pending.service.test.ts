import { describe, expect, test } from "bun:test";
import type { FieldClosedMessage, Issue, TextChangedMessage } from "@gc/protocol";
import { FieldChecks } from "./field-checks.service";
import type { WatchedField } from "./shared/issue-view";

const issueAt = (start: number): Issue => ({
  original: "teh",
  suggestion: "the",
  reason: "Spelling",
  context: "teh cat",
  type: "spelling",
  start,
  end: start + 3,
});

const setup = () => {
  const sent: (TextChangedMessage | FieldClosedMessage)[] = [];
  const shown: (readonly Issue[])[] = [];
  const badge: string[] = [];
  const checks = new FieldChecks({
    send: (message) => sent.push(message),
    view: { show: (_f, issues) => shown.push(issues), clear: () => badge.push("clear") },
    badge: {
      checking: () => badge.push("checking"),
      done: (_f, pending) => badge.push(pending ? "pending" : "done"),
      tooLong: () => badge.push("too_long"),
      offline: () => badge.push("offline"),
      failed: () => badge.push("failed"),
      hide: () => badge.push("hide"),
    },
    status: () => "ready",
    settleMs: 1000,
  });
  const field = {} as WatchedField;
  const text = "teh cat. teh dog.";
  checks.changed(field, "f1", 1, text, "focus");
  const result = (issues: Issue[], pending?: boolean) => ({
    type: "issues" as const,
    fieldId: "f1",
    version: 1,
    issues,
    ...(pending ? { pending } : {}),
  });
  return { checks, sent, shown, badge, field, text, result };
};

const types = (sent: { type: string }[]) => sent.map((m) => m.type);

describe("FieldChecks with partial results", () => {
  test("draws each partial result, keeps the spinner, then shows the final count", () => {
    const { checks, shown, badge, field, result } = setup();
    checks.issues(result([issueAt(0)], true), field);
    expect(shown).toEqual([[issueAt(0)]]);
    expect(badge.at(-1)).toBe("pending");
    checks.issues(result([issueAt(0), issueAt(9)]), field);
    expect(shown.at(-1)).toEqual([issueAt(0), issueAt(9)]);
    expect(badge.at(-1)).toBe("done");
  });

  test("a partial result is not remembered for a refocus", () => {
    const { checks, sent, field, text, result } = setup();
    checks.issues(result([issueAt(0)], true), field);
    checks.closed(field, "f1");
    checks.changed(field, "f1", 2, text, "focus");
    expect(types(sent)).toEqual(["text.changed", "text.changed"]);
  });

  test("a blurred field's close waits for the final result, not a partial one", () => {
    const { checks, sent, shown, field, text, result } = setup();
    checks.closed(field, "f1");
    checks.issues(result([issueAt(0)], true), undefined);
    expect(types(sent)).toEqual(["text.changed"]);
    checks.issues(result([issueAt(0), issueAt(9)]), undefined);
    expect(types(sent)).toEqual(["text.changed", "field.closed"]);
    // The final result is remembered: refocusing shows it and sends nothing.
    checks.changed(field, "f1", 2, text, "focus");
    expect(types(sent)).toEqual(["text.changed", "field.closed"]);
    expect(shown.at(-1)).toEqual([issueAt(0), issueAt(9)]);
  });
});
