/** Fewer ok samples than this and a cell shows no median: one slow first call would decide it. */
export const MIN_TIMED_SAMPLES = 5;

/** One ok sample as stored: letters checked, then the ms it took. */
export type TimedSample = readonly [letters: number, ms: number];

/** What one feature's cell in a row is made of, as stored. */
export type CellData = {
  readonly ok: readonly TimedSample[];
  readonly failures: Readonly<Record<string, number>>;
};

export type CellStats = {
  /** Median ms per letter to one decimal place; null below MIN_TIMED_SAMPLES ok samples. */
  readonly msPerLetter: number | null;
  readonly okCount: number;
  readonly failureCount: number;
  /** Letters over the ok samples only. */
  readonly letters: number;
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

export const cellStats = (cell: CellData): CellStats => ({
  msPerLetter: msPerLetter(cell.ok),
  okCount: cell.ok.length,
  failureCount: Object.values(cell.failures).reduce((sum, n) => sum + n, 0),
  letters: cell.ok.reduce((sum, [letters]) => sum + letters, 0),
});

/** A row's letters: the cells' letters (ok samples only) added across both features. */
export const rowLetters = (cells: readonly CellStats[]): number =>
  cells.reduce((sum, cell) => sum + cell.letters, 0);
