import type { DictionaryEntry } from "./dictionary-entry.schema";
import { containsTerm } from "./dictionary-term.matcher";

/** Entries whose term appears in the text about to be checked. */
export const relevantEntries = (
  entries: readonly DictionaryEntry[],
  text: string,
): DictionaryEntry[] => entries.filter((entry) => containsTerm(text, entry));

/** Prompt lines listing the terms the model must treat as correct. Empty when none apply. */
export const buildDictionaryContext = (entries: readonly DictionaryEntry[]): string =>
  entries
    .map((entry) => (entry.note ? `- ${entry.term} (${entry.note})` : `- ${entry.term}`))
    .join("\n");
