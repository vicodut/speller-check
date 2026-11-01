import type { Issue } from "@gc/protocol";

/** What the user chose to hide on one field, in memory only. */
export type HiddenIssues = {
  /** Dismissed occurrences, by `issueKey`. */
  keys: Set<string>;
  /** Originals added to the dictionary. */
  originals: Set<string>;
};

export const emptyHidden = (): HiddenIssues => ({ keys: new Set(), originals: new Set() });

/** Characters of surrounding text that identify an occurrence. */
const NEIGHBOURHOOD = 12;

type Keyed = Pick<Issue, "start" | "end" | "original" | "suggestion">;

/**
 * Identifies one occurrence by its original, suggestion and the text right around it, so a
 * dismissal survives edits elsewhere in the field (its offsets shift) but not edits next to it.
 */
export const issueKey = (issue: Keyed, text: string): string =>
  JSON.stringify([
    issue.original,
    issue.suggestion,
    text.slice(Math.max(0, issue.start - NEIGHBOURHOOD), issue.start),
    text.slice(issue.end, issue.end + NEIGHBOURHOOD),
  ]);

/** The issues the user hasn't dismissed or added to the dictionary. `text` is the field's. */
export const visibleIssues = (
  issues: readonly Issue[],
  hidden: HiddenIssues,
  text: string,
): Issue[] =>
  issues.filter((i) => !hidden.keys.has(issueKey(i, text)) && !hidden.originals.has(i.original));

/** The first issue whose range contains the caret offset (the end counts as inside). */
export const issueAtOffset = (issues: readonly Issue[], offset: number): Issue | undefined =>
  issues.find((i) => i.start <= offset && offset <= i.end);

type Occurrence = Pick<Issue, "start" | "end" | "original">;

/** The issue in `issues` covering the same text as `target` (a fresh result's copy of it). */
export const sameOccurrence = <T extends Occurrence>(
  issues: readonly T[],
  target: Occurrence,
): T | undefined =>
  issues.find(
    (i) => i.start === target.start && i.end === target.end && i.original === target.original,
  );
