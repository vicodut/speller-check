import { describe, expect, test } from "bun:test";
import type { Issue } from "@gc/protocol";
import { badgeLabel, elapsedText, resultState, withRephraseReady } from "./badge-state.util";

const issues = (n: number): Issue[] =>
  Array.from({ length: n }, (_, i) => ({
    original: "teh",
    suggestion: "the",
    reason: "r",
    context: "c",
    type: "spelling",
    start: i * 4,
    end: i * 4 + 3,
  }));

describe("badgeLabel", () => {
  test("shows a tick when the field is clean", () => {
    expect(badgeLabel({ kind: "count", issues: [] })).toMatchObject({
      text: "✓",
      variant: "clean",
    });
  });

  test("shows the count, capped at 9+", () => {
    expect(badgeLabel({ kind: "count", issues: issues(3) })).toMatchObject({
      text: "3",
      title: "3 issues: click to list them or rephrase",
    });
    expect(badgeLabel({ kind: "count", issues: issues(12) }).text).toBe("9+");
    expect(badgeLabel({ kind: "count", issues: issues(1) }).title).toStartWith("1 issue:");
  });

  test("explains offline and failed states without any field text", () => {
    expect(badgeLabel({ kind: "offline", status: "auth_failed" }).title).toContain("Token");
    expect(badgeLabel({ kind: "offline", status: "unreachable" }).title).toContain("reach");
    expect(badgeLabel({ kind: "failed", code: "provider_timeout" }).title).toContain(
      "provider_timeout",
    );
  });
});

describe("badgeLabel too long", () => {
  test("is its own state, naming the cap, with no panel variant", () => {
    const label = badgeLabel({ kind: "too_long" });
    expect(label.variant).toBe("too-long");
    expect(label.text).toBe("…");
    expect(label.title).toContain("Too long");
    expect(label.title).toContain("20,000");
  });
});

describe("resultState", () => {
  test("a pending result keeps the spinner and its start; the final one shows the count", () => {
    expect(resultState(issues(2), 500, true)).toEqual({ kind: "checking", since: 500 });
    expect(badgeLabel(resultState(issues(2), 500, true)).variant).toBe("checking");
    expect(resultState(issues(2), 500, false)).toEqual({ kind: "count", issues: issues(2) });
    expect(resultState(issues(2), 500)).toEqual({ kind: "count", issues: issues(2) });
  });
});

describe("elapsedText", () => {
  test("is empty for the first 10 s", () => {
    expect(elapsedText(1_000, 1_000)).toBe("");
    expect(elapsedText(1_000, 10_999)).toBe("");
  });

  test("counts whole seconds from 10 s", () => {
    expect(elapsedText(1_000, 11_000)).toBe("10s");
    expect(elapsedText(1_000, 24_500)).toBe("23s");
    expect(elapsedText(0, 59_999)).toBe("59s");
  });

  test("switches to minutes and seconds from 60 s", () => {
    expect(elapsedText(0, 60_000)).toBe("1m 0s");
    expect(elapsedText(0, 61_000)).toBe("1m 1s");
    expect(elapsedText(0, 185_000)).toBe("3m 5s");
  });
});

describe("badgeLabel checking", () => {
  test("shows the elapsed time from 10 s, in the label and the tooltip", () => {
    const state = { kind: "checking", since: 0 } as const;
    expect(badgeLabel(state, 9_000)).toEqual({
      text: "",
      title: "Checking…",
      variant: "checking",
      elapsed: "",
    });
    expect(badgeLabel(state, 23_000)).toMatchObject({ title: "Checking… 23s", elapsed: "23s" });
    expect(badgeLabel(state, 61_000).elapsed).toBe("1m 1s");
  });

  test("without a clock it shows no time", () => {
    expect(badgeLabel({ kind: "checking", since: 0 }).elapsed).toBe("");
  });

  test("other states have no elapsed time", () => {
    expect(badgeLabel({ kind: "too_long" }, 99_000).elapsed).toBeUndefined();
  });
});

describe("withRephraseReady", () => {
  test("marks the tooltip but never changes the count", () => {
    const label = badgeLabel({ kind: "count", issues: issues(3) });
    const ready = withRephraseReady(label, true);
    expect(ready.text).toBe("3");
    expect(ready.variant).toBe("issues");
    expect(ready.title).toEndWith("Rephrase ready");
    expect(withRephraseReady(label, false)).toEqual(label);
  });
});
