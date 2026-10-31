import type { Issue } from "@gc/protocol";
import { shiftIssue } from "./issue-offsets.service";
import { diffTexts, type TextEdit } from "./text-diff.service";

const isBlank = (char: string | undefined): boolean => char === undefined || /\s/.test(char);

/**
 * Whether the edit only touches the issue at a boundary with whitespace (or nothing) on both
 * the removed and inserted side. Anything else at the boundary may have changed the word.
 */
const safeAtEnd = (edit: TextEdit, before: string, after: string): boolean =>
  isBlank(edit.removedEnd > edit.start ? before[edit.start] : undefined) &&
  isBlank(edit.insertedEnd > edit.start ? after[edit.start] : undefined);

const safeAtStart = (edit: TextEdit, before: string, after: string): boolean =>
  isBlank(edit.removedEnd > edit.start ? before[edit.removedEnd - 1] : undefined) &&
  isBlank(edit.insertedEnd > edit.start ? after[edit.insertedEnd - 1] : undefined);

/** The issue's position in `after`, or undefined when the edit touched it. */
const remap = (issue: Issue, edit: TextEdit, before: string, after: string): Issue | undefined => {
  if (issue.end < edit.start) return issue;
  if (issue.start > edit.removedEnd) return shiftIssue(issue, edit.insertedEnd - edit.removedEnd);
  if (issue.end === edit.start && safeAtEnd(edit, before, after)) return issue;
  if (issue.start === edit.removedEnd && safeAtStart(edit, before, after)) {
    return shiftIssue(issue, edit.insertedEnd - edit.removedEnd);
  }
  return undefined;
};

/**
 * Re-maps issues found on `before` onto `after`. Issues touching the edit are dropped, and an
 * issue survives only if `after` still holds its `original` at the new offsets.
 */
export const reconcileIssues = (
  issues: readonly Issue[],
  before: string,
  after: string,
): Issue[] => {
  if (before === after) return [...issues];
  const edit = diffTexts(before, after);
  return issues.flatMap((issue) => {
    const moved = remap(issue, edit, before, after);
    return moved && after.slice(moved.start, moved.end) === moved.original ? [moved] : [];
  });
};
