import type { Issue } from "@gc/protocol";

type IssueRange = Pick<Issue, "start" | "end" | "original">;
type IssueFix = IssueRange & Pick<Issue, "suggestion">;

/** True when the issue's range in `text` still holds the flagged original. */
export const matchesText = (text: string, issue: IssueRange): boolean =>
  text.slice(issue.start, issue.end) === issue.original;

/** The text the field should hold once the fix is applied. */
export const expectedTextAfterFix = (text: string, issue: IssueFix): string =>
  text.slice(0, issue.start) + issue.suggestion + text.slice(issue.end);

/**
 * The other issues once `fixed` is applied: those before it stay, those after it shift by the
 * length change, and any overlapping it are dropped (their text no longer exists).
 */
export const issuesAfterFix = <T extends IssueFix>(issues: readonly T[], fixed: IssueFix): T[] => {
  const delta = fixed.suggestion.length - (fixed.end - fixed.start);
  return issues.flatMap((issue) => {
    if (issue === fixed) return [];
    if (issue.end <= fixed.start) return [issue];
    if (issue.start >= fixed.end) {
      return [{ ...issue, start: issue.start + delta, end: issue.end + delta }];
    }
    return [];
  });
};
