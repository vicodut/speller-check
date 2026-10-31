import { describe, expect, test } from "bun:test";
import type { Issue } from "@gc/protocol";
import { reconcileIssues } from "./issue-reconciler.service";

const issueAt = (text: string, original: string, from = 0): Issue => {
  const start = text.indexOf(original, from);
  if (start < 0) throw new Error("fixture: original not in text");
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

const spans = (text: string, issues: readonly Issue[]): string[] =>
  issues.map((i) => text.slice(i.start, i.end));

describe("reconcileIssues", () => {
  const before = "I has went to teh shop.";
  const issues = [issueAt(before, "has went"), issueAt(before, "teh")];

  test("same texts keep the same issues", () => {
    expect(reconcileIssues(issues, before, before)).toEqual(issues);
  });

  test("issues after the edit shift by the length delta", () => {
    const after = `Yesterday ${before}`;
    expect(spans(after, reconcileIssues(issues, before, after))).toEqual(["has went", "teh"]);
  });

  test("issues before the edit stay put", () => {
    const after = "I has went to teh big shop.";
    const result = reconcileIssues(issues, before, after);
    expect(result).toEqual(issues);
  });

  test("an issue overlapping the edited range is dropped", () => {
    const after = "I have gone to teh shop.";
    expect(spans(after, reconcileIssues(issues, before, after))).toEqual(["teh"]);
  });

  test("an insertion inside an issue drops it", () => {
    const after = "I has went to tieh shop.";
    expect(spans(after, reconcileIssues(issues, before, after))).toEqual(["has went"]);
  });

  test("a word character typed right after an issue drops it", () => {
    const after = "I has went to tehs shop.";
    expect(spans(after, reconcileIssues(issues, before, after))).toEqual(["has went"]);
  });

  test("a word character typed right before an issue drops it", () => {
    const after = "I has went to steh shop.";
    expect(spans(after, reconcileIssues(issues, before, after))).toEqual(["has went"]);
  });

  test("whitespace typed at an issue boundary keeps it", () => {
    const text = "fix teh";
    const after = "fix teh now";
    const result = reconcileIssues([issueAt(text, "teh")], text, after);
    expect(spans(after, result)).toEqual(["teh"]);
  });

  test("deleting the text after an issue keeps it", () => {
    const text = "fix teh now";
    const after = "fix teh";
    const result = reconcileIssues([issueAt(text, "teh")], text, after);
    expect(spans(after, result)).toEqual(["teh"]);
  });

  test("whitespace typed right before an issue keeps it", () => {
    const text = "fix teh";
    const after = "fix  teh";
    const result = reconcileIssues([issueAt(text, "teh")], text, after);
    expect(spans(after, result)).toEqual(["teh"]);
  });

  test("drops an issue whose original no longer matches at the new spot", () => {
    const stale = { ...issueAt(before, "teh"), original: "the" };
    expect(reconcileIssues([stale], before, `X ${before}`)).toEqual([]);
  });

  test("everything replaced drops everything", () => {
    expect(reconcileIssues(issues, before, "Totally new.")).toEqual([]);
  });

  test("shifts across surrogate pairs in UTF-16 units", () => {
    const after = `\u{1F600} ${before}`;
    expect(spans(after, reconcileIssues(issues, before, after))).toEqual(["has went", "teh"]);
  });
});
