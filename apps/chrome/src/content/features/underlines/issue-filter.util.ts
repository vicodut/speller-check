import type { Issue } from "@gc/protocol";

/** What the user chose to hide on one field, in memory only. */
export type HiddenIssues = {
  /** Dismissed occurrences, by `issueKey`. */
  keys: Set<string>;
  /** Originals added to the dictionary. */
  originals: Set<string>;
};

export const emptyHidden = (): HiddenIssues => ({ keys: new Set(), originals: new Set() });

/** Identifies one occurrence: its start, original and suggestion. */
export const issueKey = (issue: Pick<Issue, "start" | "original" | "suggestion">): string =>
  JSON.stringify([issue.start, issue.original, issue.suggestion]);

/** The issues the user hasn't dismissed or added to the dictionary. */
export const visibleIssues = (issues: readonly Issue[], hidden: HiddenIssues): Issue[] =>
  issues.filter((i) => !hidden.keys.has(issueKey(i)) && !hidden.originals.has(i.original));

/** The first issue whose range contains the caret offset (the end counts as inside). */
export const issueAtOffset = (issues: readonly Issue[], offset: number): Issue | undefined =>
  issues.find((i) => i.start <= offset && offset <= i.end);
