import type { Issue } from "@gc/protocol";

/** Moves an issue's offsets by `delta` (sentence-relative ↔ absolute). */
export const shiftIssue = (issue: Issue, delta: number): Issue => ({
  ...issue,
  start: issue.start + delta,
  end: issue.end + delta,
});

/** Sorts by start and drops any issue overlapping an earlier one: first one wins. */
export const dropOverlaps = (issues: readonly Issue[]): Issue[] => {
  const sorted = [...issues].sort((a, b) => a.start - b.start || a.end - b.end);
  const kept: Issue[] = [];
  for (const issue of sorted) {
    const previous = kept.at(-1);
    if (!previous || issue.start >= previous.end) kept.push(issue);
  }
  return kept;
};
