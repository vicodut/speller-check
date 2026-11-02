import { describe, expect, test } from "bun:test";
import type { Issue } from "@gc/protocol";
import { badgeLabel } from "./badge-state.util";

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
