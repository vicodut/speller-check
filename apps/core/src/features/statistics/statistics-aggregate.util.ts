/** Fewer ok samples than this and a cell shows no median: one slow first call would decide it. */
export const MIN_TIMED_SAMPLES = 5;

/**
 * One ok sample as stored: letters checked, the ms it took, then the words checked. Samples saved
 * before word counts have no third value, and count toward letters only.
 */
export type TimedSample = readonly [letters: number, ms: number, words?: number | undefined];

/** What one feature's cell in a row is made of, as stored. */
export type CellData = {
  readonly ok: readonly TimedSample[];
  readonly failures: Readonly<Record<string, number>>;
};

export type CellStats = {
  /** Median ms per letter to one decimal place; null below MIN_TIMED_SAMPLES ok samples. */
  readonly msPerLetter: number | null;
  /** Median ms per word to one decimal place over the samples with a word count; null below MIN_TIMED_SAMPLES of them. */
  readonly msPerWord: number | null;
  readonly okCount: number;
  readonly failureCount: number;
  /** Letters over the ok samples only. */
  readonly letters: number;
  /** Words over the ok samples that have a word count; null when none has one. */
  readonly words: number | null;
};

export const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] ?? 0) + upper) / 2;
};

const oneDecimal = (value: number): number => Math.round(value * 10) / 10;

export const msPerLetter = (ok: readonly TimedSample[]): number | null => {
  if (ok.length < MIN_TIMED_SAMPLES) return null;
  return oneDecimal(median(ok.map(([letters, ms]) => ms / letters)));
};

/** Only a sample with a word count above zero has a ms per word; the others are left out. */
const withWords = (ok: readonly TimedSample[]): [words: number, ms: number][] =>
  ok.flatMap(([, ms, words]): [number, number][] => (words && words > 0 ? [[words, ms]] : []));

export const msPerWord = (ok: readonly TimedSample[]): number | null => {
  const counted = withWords(ok);
  if (counted.length < MIN_TIMED_SAMPLES) return null;
  return oneDecimal(median(counted.map(([words, ms]) => ms / words)));
};

const wordsOf = (ok: readonly TimedSample[]): number | null => {
  const counted = ok.flatMap(([, , words]) => (words === undefined ? [] : [words]));
  return counted.length === 0 ? null : counted.reduce((sum, n) => sum + n, 0);
};

export const cellStats = (cell: CellData): CellStats => ({
  msPerLetter: msPerLetter(cell.ok),
  msPerWord: msPerWord(cell.ok),
  okCount: cell.ok.length,
  failureCount: Object.values(cell.failures).reduce((sum, n) => sum + n, 0),
  letters: cell.ok.reduce((sum, [letters]) => sum + letters, 0),
  words: wordsOf(cell.ok),
});

/** A row's letters: the cells' letters (ok samples only) added across both features. */
export const rowLetters = (cells: readonly CellStats[]): number =>
  cells.reduce((sum, cell) => sum + cell.letters, 0);

/** A row's words: the cells' word counts added, skipping a cell with none; null if no cell has one. */
export const rowWords = (cells: readonly CellStats[]): number | null => {
  const counted = cells.flatMap((cell) => (cell.words === null ? [] : [cell.words]));
  return counted.length === 0 ? null : counted.reduce((sum, n) => sum + n, 0);
};
