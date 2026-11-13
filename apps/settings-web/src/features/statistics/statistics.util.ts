import type { StatisticsCell } from "@gc/protocol";

/** The median as the page shows it: ms per letter to one decimal, or a note until there are enough samples. */
export const formatMsPerLetter = (value: number | null): string =>
  value === null ? "Not enough data" : `${value.toFixed(1)} ms per letter`;

/** A cell's counts on one line: ok and failed calls, and the letters the ok calls checked. */
export const cellCounts = (cell: StatisticsCell): string =>
  `${cell.okCount} ok · ${cell.failureCount} failed · ${cell.letters} letters`;

/** Whether the profile's endpoint runs on this Mac (text stays here) or not. */
export const placeTag = (local: boolean): string => (local ? "Local" : "Cloud");
