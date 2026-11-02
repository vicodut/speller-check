import type { Issue } from "@gc/protocol";

/** English contraction endings and the words they stand for. */
const CONTRACTIONS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["n't", ["not"]],
  ["'re", ["are"]],
  ["'m", ["am"]],
  ["'ve", ["have"]],
  ["'ll", ["will"]],
  ["'s", ["is", "has"]],
  ["'d", ["would", "had"]],
];

const normalize = (word: string): string => word.toLowerCase().replace(/[’ʼ]/gu, "'");
const words = (text: string): string[] => text.trim().split(/\s+/u).filter(Boolean).map(normalize);

/** The suggestion's words, plus one variant per expansion of a trailing contraction. */
const spellings = (suggestion: string): string[][] => {
  const plain = words(suggestion);
  const last = plain.at(-1) ?? "";
  const ending = CONTRACTIONS.find(([suffix]) => last.endsWith(suffix) && last !== suffix);
  if (!ending) return [plain];
  const stem = last.slice(0, -ending[0].length);
  return [plain, ...ending[1].map((full) => [...plain.slice(0, -1), stem, full])];
};

const startsWith = (list: readonly string[], head: readonly string[]): boolean =>
  head.every((word, i) => list[i] === word);

/** Most leading words of `next` that `previous` already ends with, and `original` doesn't start with. */
const echoedCount = (previous: Issue, next: Issue): number => {
  const head = words(next.suggestion);
  const original = words(next.original);
  let best = 0;
  for (const spelled of spellings(previous.suggestion)) {
    for (let k = Math.min(head.length, spelled.length); k > best; k--) {
      const echoed = head.slice(0, k);
      if (startsWith(spelled.slice(-k), echoed) && !startsWith(original, echoed)) best = k;
    }
  }
  return best;
};

const dropLeadingWords = (text: string, count: number): string =>
  text
    .trim()
    .replace(new RegExp(`^(?:\\S+\\s+){${count}}`, "u"), "")
    .trim();

/** `next` without the words `previous` already supplies, or undefined when nothing is left to fix. */
const trimAgainst = (previous: Issue, next: Issue, text: string): Issue | undefined => {
  if (!/^\s*$/u.test(text.slice(previous.end, next.start))) return next;
  const count = echoedCount(previous, next);
  if (count === 0) return next;
  const suggestion = dropLeadingWords(next.suggestion, count);
  if (suggestion === "" || suggestion === next.original) return undefined;
  return { ...next, suggestion };
};

/**
 * Models sometimes fix one spot twice across neighbouring issues ("Their" → "They're" and
 * "going" → "are going"), so accepting both duplicates a word. When only whitespace separates an
 * issue from the previous kept one, leading words of its suggestion that the previous suggestion
 * already ends with (expanding a trailing English contraction) are removed; the issue is dropped
 * if what is left is empty or equals its original. Expects issues sorted and non-overlapping.
 */
export const trimNeighbourEchoes = (issues: readonly Issue[], text: string): Issue[] => {
  const kept: Issue[] = [];
  for (const issue of issues) {
    const previous = kept.at(-1);
    const trimmed = previous ? trimAgainst(previous, issue, text) : issue;
    if (trimmed) kept.push(trimmed);
  }
  return kept;
};
