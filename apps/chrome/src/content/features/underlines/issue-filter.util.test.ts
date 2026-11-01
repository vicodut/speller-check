import { describe, expect, test } from "bun:test";
import type { Issue } from "@gc/protocol";
import {
  emptyHidden,
  issueAtOffset,
  issueKey,
  sameOccurrence,
  visibleIssues,
} from "./issue-filter.util";

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

const text = "I am teh one to recieve it.";

describe("issueKey", () => {
  test("differs by original, suggestion and surrounding text", () => {
    const same = "Say teh word.";
    const keys = [
      issueKey(teh, text),
      issueKey(make(5, "teh", "tea"), text),
      issueKey(make(4, "teh", "the"), same),
    ];
    expect(new Set(keys).size).toBe(3);
  });

  test("survives edits away from the issue, not next to it", () => {
    const base = "First words here. The rest is fine. I am teh one.";
    const at = (t: string) => make(t.indexOf("teh"), "teh", "the");
    const far = base.replace("First", "Opening");
    const near = base.replace("I am", "You are");
    expect(issueKey(at(far), far)).toBe(issueKey(at(base), base));
    expect(issueKey(at(near), near)).not.toBe(issueKey(at(base), base));
  });

  test("ignores reason and type", () => {
    const withReason: Issue = { ...teh, reason: "other", type: "grammar" };
    expect(issueKey(withReason, text)).toBe(issueKey(teh, text));
  });
});

describe("visibleIssues", () => {
  test("keeps everything when nothing is hidden", () => {
    expect(visibleIssues([teh, recieve], emptyHidden(), text)).toEqual([teh, recieve]);
  });

  test("drops a dismissed occurrence only", () => {
    const long = `${text} Then teh end.`;
    const other = make(long.lastIndexOf("teh"), "teh", "the");
    const hidden = emptyHidden();
    hidden.keys.add(issueKey(teh, long));
    expect(visibleIssues([teh, recieve, other], hidden, long)).toEqual([recieve, other]);
  });

  test("drops every issue with an original added to the dictionary", () => {
    const hidden = emptyHidden();
    hidden.originals.add("teh");
    expect(visibleIssues([teh, recieve, make(30, "teh")], hidden, text)).toEqual([recieve]);
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

describe("sameOccurrence", () => {
  const base = { start: 4, end: 7, original: "teh" };

  test("finds the matching issue in a fresh result", () => {
    const fresh = [{ ...base, start: 0, end: 3 }, { ...base }];
    expect(sameOccurrence(fresh, base)).toBe(fresh[1]);
  });

  test("returns undefined when the occurrence moved or changed", () => {
    expect(sameOccurrence([{ ...base, start: 5, end: 8 }], base)).toBeUndefined();
    expect(sameOccurrence([{ ...base, original: "tah" }], base)).toBeUndefined();
  });
});
