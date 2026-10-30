import type { DictionaryEntry } from "./dictionary-entry.schema";
import { containsTerm, isTerm } from "./dictionary-term.matcher";

type Flaggable = { readonly original: string; readonly suggestion: string };

/**
 * Hard guarantee that dictionary terms are never flagged. An issue is dropped when its
 * `original` is a term, or contains a term that the suggestion changes or removes.
 * "NestJS are" → "NestJS is" survives: it fixes the grammar and keeps the term.
 */
export const filterDictionaryTerms = <T extends Flaggable>(
  issues: readonly T[],
  entries: readonly DictionaryEntry[],
): T[] => issues.filter((issue) => !entries.some((entry) => touchesTerm(issue, entry)));

const touchesTerm = (issue: Flaggable, entry: DictionaryEntry): boolean =>
  isTerm(issue.original, entry) ||
  (containsTerm(issue.original, entry) && !containsTerm(issue.suggestion, entry));
