import { describe, expect, test } from "bun:test";
import type { CoreMessage, Issue } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import { type Checker, DEBOUNCE_MS, FieldSessions, type Timers } from "./field-sessions.service";

type CheckResult = Result<{ version?: number; issues: Issue[] }, AppError>;

const fakeTimers = () => {
  let next = 0;
  const pending = new Map<number, { fn: () => void; ms: number }>();
  const timers: Timers = {
    setTimeout: (fn, ms) => {
      pending.set(++next, { fn, ms });
      return next;
    },
    clearTimeout: (handle) => pending.delete(handle as number),
  };
  const fire = () => {
    const due = [...pending.values()];
    pending.clear();
    for (const t of due) t.fn();
  };
  return { timers, pending, fire };
};

/** Each check call parks until the test resolves it. */
const fakeChecker = () => {
  const calls: { text: string; version?: number; resolve: (r: CheckResult) => void }[] = [];
  const checker: Checker = {
    check: (input) => new Promise((resolve) => calls.push({ ...input, resolve })),
  };
  return { checker, calls };
};

const issueIn = (text: string, original: string): Issue => {
  const start = text.indexOf(original);
  return {
    original,
    suggestion: "x",
    reason: "r",
    context: original,
    type: "spelling",
    start,
    end: start + original.length,
  };
};

const setup = () => {
  const clock = fakeTimers();
  const { checker, calls } = fakeChecker();
  const published: CoreMessage[] = [];
  const logs: string[] = [];
  const sessions = new FieldSessions(
    checker,
    (m) => published.push(m),
    new Logger((l) => logs.push(l)),
    { timers: clock.timers },
  );
  return { clock, calls, published, logs, sessions };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const spans = (message: CoreMessage | undefined, text: string) =>
  message?.type === "issues" ? message.issues.map((i) => text.slice(i.start, i.end)) : message;

describe("FieldSessions", () => {
  test("debounces rapid updates into one check of the latest text", async () => {
    const { clock, calls, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: "I" });
    sessions.update({ fieldId: "f", version: 2, text: "I has" });
    sessions.update({ fieldId: "f", version: 3, text: "I has went" });
    expect(clock.pending.size).toBe(1);
    expect([...clock.pending.values()][0]?.ms).toBe(DEBOUNCE_MS);
    clock.fire();
    expect(calls.map((c) => [c.version, c.text])).toEqual([[3, "I has went"]]);
    calls[0]?.resolve(ok({ version: 3, issues: [issueIn("I has went", "has went")] }));
    await flush();
    expect(published).toEqual([
      { type: "issues", fieldId: "f", version: 3, issues: [issueIn("I has went", "has went")] },
    ]);
  });

  test("ignores versions not newer than the latest", () => {
    const { clock, calls, sessions } = setup();
    sessions.update({ fieldId: "f", version: 5, text: "new" });
    sessions.update({ fieldId: "f", version: 4, text: "old" });
    sessions.update({ fieldId: "f", version: 5, text: "dup" });
    clock.fire();
    expect(calls.map((c) => c.text)).toEqual(["new"]);
  });

  test("keeps fields independent", () => {
    const { clock, calls, sessions } = setup();
    sessions.update({ fieldId: "a", version: 1, text: "A" });
    sessions.update({ fieldId: "b", version: 1, text: "B" });
    clock.fire();
    expect(calls.map((c) => c.text).sort()).toEqual(["A", "B"]);
  });

  test("reconciles a stale result onto the newer text", async () => {
    const { clock, calls, published, logs, sessions } = setup();
    const v1 = "I has went to teh shop.";
    const v2 = "I has went to teh shopping.";
    sessions.update({ fieldId: "f", version: 1, text: v1 });
    clock.fire();
    sessions.update({ fieldId: "f", version: 2, text: v2 });
    const issues = [issueIn(v1, "has went"), issueIn(v1, "teh"), issueIn(v1, "shop.")];
    calls[0]?.resolve(ok({ version: 1, issues }));
    await flush();
    expect(published[0]).toMatchObject({ type: "issues", version: 2 });
    expect(spans(published[0], v2)).toEqual(["has went", "teh"]);
    expect(logs.map((l) => JSON.parse(l))).toContainEqual({
      level: "info",
      event: "reconcile.dropped",
      len: 1,
    });
  });

  test("drops an older result arriving after a newer one", async () => {
    const { clock, calls, published, logs, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: "teh" });
    clock.fire();
    sessions.update({ fieldId: "f", version: 2, text: "teh cat" });
    clock.fire();
    calls[1]?.resolve(ok({ version: 2, issues: [issueIn("teh cat", "teh")] }));
    await flush();
    calls[0]?.resolve(ok({ version: 1, issues: [issueIn("teh", "teh")] }));
    await flush();
    expect(published.map((m) => m.type === "issues" && m.version)).toEqual([2]);
    expect(logs.some((l) => l.includes("session.stale_dropped"))).toBe(true);
  });

  test("publishes an older result reconciled when it arrives first", async () => {
    const { clock, calls, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: "teh" });
    clock.fire();
    sessions.update({ fieldId: "f", version: 2, text: "teh cat" });
    clock.fire();
    calls[0]?.resolve(ok({ version: 1, issues: [issueIn("teh", "teh")] }));
    await flush();
    calls[1]?.resolve(ok({ version: 2, issues: [] }));
    await flush();
    expect(published[0]).toMatchObject({ version: 2 });
    expect(spans(published[0], "teh cat")).toEqual(["teh"]);
    // The fresh v2 result is dropped too: a v2 result was already published.
    expect(published).toHaveLength(1);
  });

  test("close cancels the timer and drops in-flight results", async () => {
    const { clock, calls, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: "teh" });
    clock.fire();
    sessions.update({ fieldId: "f", version: 2, text: "teh cat" });
    sessions.close("f");
    expect(clock.pending.size).toBe(0);
    calls[0]?.resolve(ok({ version: 1, issues: [] }));
    await flush();
    expect(published).toEqual([]);
  });

  test("a reopened field ignores results from before it was closed", async () => {
    const { clock, calls, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: "teh" });
    clock.fire();
    sessions.close("f");
    sessions.update({ fieldId: "f", version: 1, text: "other" });
    calls[0]?.resolve(ok({ version: 1, issues: [issueIn("teh", "teh")] }));
    await flush();
    expect(published).toEqual([]);
  });

  test("dispose drops everything and ignores later updates", async () => {
    const { clock, calls, published, sessions } = setup();
    sessions.update({ fieldId: "a", version: 1, text: "A" });
    clock.fire();
    sessions.update({ fieldId: "b", version: 1, text: "B" });
    sessions.dispose();
    expect(clock.pending.size).toBe(0);
    sessions.update({ fieldId: "c", version: 1, text: "C" });
    expect(clock.pending.size).toBe(0);
    calls[0]?.resolve(ok({ version: 1, issues: [] }));
    await flush();
    expect(published).toEqual([]);
  });

  test("publishes a failed check as an error code for the field", async () => {
    const { clock, calls, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: "teh" });
    clock.fire();
    calls[0]?.resolve(err(appError("provider_timeout")));
    await flush();
    expect(published).toEqual([{ type: "error", code: "provider_timeout", fieldId: "f" }]);
  });

  test("never logs user text", async () => {
    const { clock, calls, logs, sessions } = setup();
    const v1 = "secret teh words";
    sessions.update({ fieldId: "f", version: 1, text: v1 });
    clock.fire();
    sessions.update({ fieldId: "f", version: 2, text: "secret tehs words" });
    calls[0]?.resolve(ok({ version: 1, issues: [issueIn(v1, "teh")] }));
    await flush();
    expect(logs.join("\n")).not.toContain("secret");
    expect(logs.join("\n")).not.toContain("teh");
  });
});
