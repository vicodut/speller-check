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
  test("shows tenths of a second under 10 s", () => {
    expect(elapsedText(1_000, 1_000)).toBe("0.0s");
    expect(elapsedText(1_000, 3_449)).toBe("2.4s");
    expect(elapsedText(1_000, 10_999)).toBe("9.9s");
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

  test("a clock that went backwards shows zero", () => {
    expect(elapsedText(5_000, 4_000)).toBe("0.0s");
  });
});

describe("badgeLabel checking", () => {
  test("has no text and no native tooltip (the hover popup shows the time)", () => {
    expect(badgeLabel({ kind: "checking", since: 0 })).toEqual({
      text: "",
      title: "",
      variant: "checking",
    });
  });
});
