import type { Issue } from "@gc/protocol";
import type { FixtureCase } from "./fixture.schema";

type Span = { readonly start: number; readonly end: number };

export type CaseScore = {
  readonly id: string;
  readonly hits: { original: string; suggestion: string; accepted: boolean }[];
  readonly misses: string[];
  readonly extras: Issue[];
  readonly violations: string[];
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word occurrences of `needle` in `text`. */
export const occurrences = (text: string, needle: string): Span[] => {
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapeRegExp(needle)}(?![\\p{L}\\p{N}_])`,
    "gu",
  );
  return [...text.matchAll(pattern)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
};

const overlaps = (a: Span, b: Span): boolean => a.start < b.end && b.start < a.end;

/** Scores one case: expected errors hit or missed, extra issues, and dictionary violations. */
export const scoreCase = (fixture: FixtureCase, issues: readonly Issue[]): CaseScore => {
  const hits: CaseScore["hits"] = [];
  const misses: string[] = [];
  const matched = new Set<Issue>();
  for (const expected of fixture.expect) {
    const [span] = occurrences(fixture.text, expected.original);
    const issue = span && issues.find((i) => overlaps(i, span));
    if (!issue) {
      misses.push(expected.original);
      continue;
    }
    matched.add(issue);
    hits.push({
      original: expected.original,
      suggestion: issue.suggestion,
      accepted: isAccepted(issue, expected.accept),
    });
  }
  const violations = (fixture.mustNotFlag ?? []).filter((term) =>
    occurrences(fixture.text, term).some((span) =>
      issues.some((i) => overlaps(i, span) && !i.suggestion.includes(term)),
    ),
  );
  return {
    id: fixture.id,
    hits,
    misses,
    extras: issues.filter((i) => !matched.has(i)),
    violations,
  };
};

/** An accepted suggestion may cover more or less text than `original`; compare by containment. */
const isAccepted = (issue: Issue, accept: readonly string[]): boolean =>
  accept.some((a) => issue.suggestion === a || issue.suggestion.includes(a));
