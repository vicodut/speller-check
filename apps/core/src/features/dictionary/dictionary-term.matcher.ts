import type { DictionaryEntry } from "./dictionary-entry.schema";

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches the entry's term as a whole word (letters, digits and `_` count as word characters). */
export const termPattern = (entry: DictionaryEntry): RegExp =>
  new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapeRegExp(entry.term)}(?![\\p{L}\\p{N}_])`,
    entry.caseInsensitive ? "iu" : "u",
  );

export const containsTerm = (text: string, entry: DictionaryEntry): boolean =>
  termPattern(entry).test(text);

export const isTerm = (text: string, entry: DictionaryEntry): boolean =>
  entry.caseInsensitive
    ? text.trim().toLowerCase() === entry.term.toLowerCase()
    : text.trim() === entry.term;
