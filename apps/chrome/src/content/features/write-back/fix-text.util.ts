import type { Issue } from "@gc/protocol";

type IssueRange = Pick<Issue, "start" | "end" | "original">;
type IssueFix = IssueRange & Pick<Issue, "suggestion">;

/** True when the issue's range in `text` still holds the flagged original. */
export const matchesText = (text: string, issue: IssueRange): boolean =>
  text.slice(issue.start, issue.end) === issue.original;

/** The text the field should hold once the fix is applied. */
export const expectedTextAfterFix = (text: string, issue: IssueFix): string =>
  text.slice(0, issue.start) + issue.suggestion + text.slice(issue.end);
