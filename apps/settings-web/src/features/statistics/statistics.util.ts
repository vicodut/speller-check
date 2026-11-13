import type { StatisticsCell, StatisticsRow, StatisticsView } from "@gc/protocol";

/** Shown in place of the table until a model call has been timed. */
export const EMPTY_STATISTICS_TEXT =
  "Nothing has been timed yet. Checks and rephrases appear here once they run.";

/** Whether the page has no rows at all, so it shows the empty state instead of the table. */
export const hasNoTimedCalls = (view: StatisticsView): boolean => view.rows.length === 0;

/** The median as the page shows it: ms per letter to one decimal, or a note until there are enough samples. */
export const formatMsPerLetter = (value: number | null): string =>
  value === null ? "Not enough data" : `${value.toFixed(1)} ms per letter`;

/** The per-word median as the page shows it: ms per word to one decimal, or the same note until there are enough samples. */
export const formatMsPerWord = (value: number | null): string =>
  value === null ? "Not enough data" : `${value.toFixed(1)} ms per word`;

/** A row's totals side by side: letters and words; words say so until a sample carries a word count. */
export const rowTotals = (row: Pick<StatisticsRow, "letters" | "words">): string =>
  `${row.letters} letters · ${row.words === null ? "words not counted" : `${row.words} words`}`;

/** A cell's counts on one line: ok and failed calls, and the letters the ok calls checked. */
export const cellCounts = (cell: StatisticsCell): string =>
  `${cell.okCount} ok · ${cell.failureCount} failed · ${cell.letters} letters`;

/** False when the profile never ran this feature: the page says "No samples" instead of a zero figure. */
export const hasSamples = (cell: StatisticsCell): boolean =>
  cell.okCount > 0 || cell.failureCount > 0;

/** Whether the profile's endpoint runs on this Mac (text stays here) or not. */
export const placeTag = (local: boolean): string => (local ? "Local" : "Cloud");
