import { describe, expect, test } from "bun:test";
import { type CoreMessage, MAX_TEXT_LENGTH } from "@gc/protocol";
import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import { type Checker, FieldSessions, type Timers } from "./field-sessions.service";

/** Fires every pending timer at once. */
const fakeTimers = () => {
  const pending = new Map<number, () => void>();
  let next = 0;
  const timers: Timers = {
    setTimeout: (fn) => {
      pending.set(++next, fn);
      return next;
    },
    clearTimeout: (handle) => pending.delete(handle as number),
  };
  const fire = () => {
    const due = [...pending.values()];
    pending.clear();
    for (const fn of due) fn();
  };
  return { timers, fire };
};

const setup = () => {
  const clock = fakeTimers();
  const checked: string[] = [];
  const checker: Checker = {
    check: async (input) => {
      checked.push(input.text);
      return ok({ issues: [] });
    },
  };
  const published: CoreMessage[] = [];
  const logs: string[] = [];
  const sessions = new FieldSessions(
    checker,
    (m) => published.push(m),
    new Logger((l) => logs.push(l)),
    { timers: clock.timers },
  );
  return { clock, checked, published, logs, sessions };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const secret = "Private words.";
const tooLong = secret + "a".repeat(MAX_TEXT_LENGTH);

describe("FieldSessions text cap", () => {
  test("refuses text over the cap with text_too_long, without calling the checker", async () => {
    const { clock, checked, published, logs, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: tooLong });
    clock.fire();
    await flush();
    expect(checked).toEqual([]);
    expect(published).toEqual([{ type: "error", code: "text_too_long", fieldId: "f" }]);
    expect(logs.join("\n")).toContain(`"len":${tooLong.length},"code":"text_too_long"`);
    expect(logs.join("\n")).not.toContain(secret);
  });

  test("checks again once the field is back under the cap", async () => {
    const { clock, checked, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: tooLong });
    clock.fire();
    await flush();
    sessions.update({ fieldId: "f", version: 2, text: secret });
    clock.fire();
    await flush();
    expect(checked).toEqual([secret]);
    expect(published.at(-1)).toEqual({ type: "issues", fieldId: "f", version: 2, issues: [] });
  });
});
