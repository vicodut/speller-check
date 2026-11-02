/** A span of the field text (UTF-16 offsets, `end` exclusive). */
type Span = { readonly start: number; readonly end: number };

/** A passage as the core located it: the field text it read, the passage and its sentences. */
export type PassageBase = {
  readonly text: string;
  readonly passage: Span;
  readonly sentences: readonly Span[];
};

/** Sentences `from`..`to` (inclusive) of the passage, replaced in the field by `text`. */
export type ReplacedRun = { readonly from: number; readonly to: number; readonly text: string };

/** One edit of the field text, in the shape the write-back applies. */
export type TextFix = {
  readonly start: number;
  readonly end: number;
  readonly original: string;
  readonly suggestion: string;
};

const runSpan = (base: PassageBase, run: Pick<ReplacedRun, "from" | "to">): Span => ({
  start: base.sentences[run.from]?.start ?? base.passage.start,
  end: base.sentences[run.to]?.end ?? base.passage.end,
});

const byStart = (a: ReplacedRun, b: ReplacedRun) => a.from - b.from;

/** True when `inner` lies inside `outer`. */
export const runContains = (outer: Pick<ReplacedRun, "from" | "to">, inner: ReplacedRun) =>
  inner.from >= outer.from && inner.to <= outer.to;

/** True when the runs share no sentence. */
export const runsDisjoint = (a: Pick<ReplacedRun, "from" | "to">, b: ReplacedRun) =>
  a.to < b.from || b.to < a.from;

/** The passage text once `runs` (disjoint) are applied to the base passage. */
export const passageWithRuns = (base: PassageBase, runs: readonly ReplacedRun[]): string => {
  let out = "";
  let at = base.passage.start;
  for (const run of [...runs].sort(byStart)) {
    const span = runSpan(base, run);
    out += base.text.slice(at, span.start) + run.text;
    at = span.end;
  }
  return out + base.text.slice(at, base.passage.end);
};

/** Where an offset of the base text sits once `runs` are applied (offsets outside any run). */
const shifted = (base: PassageBase, runs: readonly ReplacedRun[], offset: number): number =>
  runs.reduce((at, run) => {
    const span = runSpan(base, run);
    return span.end <= offset ? at + run.text.length - (span.end - span.start) : at;
  }, offset);

/**
 * Replace: the edit that writes `run` over its sentences, with `runs` already applied. Any
 * applied run inside it is overwritten. Returns the fix and the runs applied afterwards.
 */
export const replaceRunFix = (
  base: PassageBase,
  runs: readonly ReplacedRun[],
  run: ReplacedRun,
): { fix: TextFix; runs: ReplacedRun[] } => {
  const span = runSpan(base, run);
  const start = shifted(base, runs, span.start);
  const end = shifted(base, runs, span.end);
  const current = passageWithRuns(base, runs);
  const offset = base.passage.start;
  const original = current.slice(start - offset, end - offset);
  const kept = runs.filter((r) => !runContains(run, r));
  return {
    fix: { start, end, original, suggestion: run.text },
    runs: [...kept, run].sort(byStart),
  };
};

/**
 * Replace all: one edit over the whole passage, so later offsets never drift. The passage
 * becomes the base passage with `next` applied, whatever `runs` replaced before.
 */
export const replacePassageFix = (
  base: PassageBase,
  runs: readonly ReplacedRun[],
  next: readonly ReplacedRun[],
): { fix: TextFix; runs: ReplacedRun[] } => {
  const original = passageWithRuns(base, runs);
  const start = base.passage.start;
  return {
    fix: { start, end: start + original.length, original, suggestion: passageWithRuns(base, next) },
    runs: [...next].sort(byStart),
  };
};

/** True while the field still holds the passage (with `runs` applied) at its offsets. */
export const holdsPassage = (
  base: PassageBase,
  runs: readonly ReplacedRun[],
  currentText: string,
): boolean => {
  const expected = passageWithRuns(base, runs);
  const start = base.passage.start;
  return currentText.slice(start, start + expected.length) === expected;
};
