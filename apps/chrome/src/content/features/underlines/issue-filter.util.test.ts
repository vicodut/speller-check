import { describe, expect, test } from "bun:test";
import type { Issue } from "@gc/protocol";
import { emptyHidden, issueAtOffset, issueKey, visibleIssues } from "./issue-filter.util";

const make = (start: number, original: string, suggestion = "x"): Issue => ({
  start,
  end: start + original.length,
  original,
  suggestion,
  reason: "",
  context: "",
  type: "spelling",
});

const teh = make(5, "teh", "the");
const recieve = make(12, "recieve", "receive");

describe("issueKey", () => {
  test("differs by start, original and suggestion", () => {
    const keys = [teh, make(6, "teh", "the"), make(5, "teh", "tea"), make(5, "teH", "the")];
    expect(new Set(keys.map(issueKey)).size).toBe(4);
  });

  test("ignores reason and type", () => {
    const withReason: Issue = { ...teh, reason: "other", type: "grammar" };
    expect(issueKey(withReason)).toBe(issueKey(teh));
  });
});

describe("visibleIssues", () => {
  test("keeps everything when nothing is hidden", () => {
    expect(visibleIssues([teh, recieve], emptyHidden())).toEqual([teh, recieve]);
  });

  test("drops a dismissed occurrence only", () => {
    const hidden = emptyHidden();
    hidden.keys.add(issueKey(teh));
    const other = make(30, "teh", "the");
    expect(visibleIssues([teh, recieve, other], hidden)).toEqual([recieve, other]);
  });

  test("drops every issue with an original added to the dictionary", () => {
    const hidden = emptyHidden();
    hidden.originals.add("teh");
    expect(visibleIssues([teh, recieve, make(30, "teh")], hidden)).toEqual([recieve]);
  });
});

describe("issueAtOffset", () => {
  const issues = [teh, recieve];

  test("finds the issue under the caret, edges included", () => {
    expect(issueAtOffset(issues, 5)).toBe(teh);
    expect(issueAtOffset(issues, 7)).toBe(teh);
    expect(issueAtOffset(issues, 8)).toBe(teh);
    expect(issueAtOffset(issues, 15)).toBe(recieve);
  });

  test("returns undefined between issues", () => {
    expect(issueAtOffset(issues, 4)).toBeUndefined();
    expect(issueAtOffset(issues, 10)).toBeUndefined();
  });
});
