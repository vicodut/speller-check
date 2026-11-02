import type { RephraseVersion } from "@gc/protocol";
import {
  type PassageBase,
  type ReplacedRun,
  replacePassageFix,
  replaceRunFix,
  runContains,
  runsDisjoint,
  type TextFix,
} from "../write-back";

/**
 * A rewritten part's Replace button: shown while `available`; `applied` when the field holds
 * it; `blocked` when a part already replaced straddles its edge, so its sentences no longer
 * stand on their own in the field.
 */
export type ReplaceStatus = "available" | "applied" | "blocked";

const sameRun = (a: ReplacedRun, b: ReplacedRun) =>
  a.from === b.from && a.to === b.to && a.text === b.text;

/** The status of rewritten part `part`, given the parts already replaced in the field. */
export const segmentStatus = (part: ReplacedRun, runs: readonly ReplacedRun[]): ReplaceStatus => {
  if (runs.some((run) => sameRun(run, part))) return "applied";
  const straddles = runs.some((run) => !runsDisjoint(part, run) && !runContains(part, run));
  return straddles ? "blocked" : "available";
};

/** A version's rewritten parts; kept sentences stay as the passage has them. */
export const versionRuns = (version: RephraseVersion): ReplacedRun[] =>
  version.segments.flatMap((s) => ("text" in s ? [{ from: s.from, to: s.to, text: s.text }] : []));

/** True when the field holds exactly this version: nothing left for Replace all to do. */
export const isVersionApplied = (version: RephraseVersion, runs: readonly ReplacedRun[]) => {
  const own = versionRuns(version);
  return own.length === runs.length && own.every((run) => runs.some((r) => sameRun(r, run)));
};

/** The edit to write and the parts the field holds once it lands. */
export type ReplacePlan = { readonly fix: TextFix; readonly runs: ReplacedRun[] };

/**
 * Plans Replace of one rewritten part (`segment` index) or, without a segment, Replace all of
 * the version. Undefined when that button isn't offered.
 */
export const planReplace = (
  base: PassageBase,
  runs: readonly ReplacedRun[],
  version: RephraseVersion,
  segment?: number,
): ReplacePlan | undefined => {
  if (segment === undefined) {
    const next = versionRuns(version);
    if (next.length === 0 || isVersionApplied(version, runs)) return undefined;
    return replacePassageFix(base, runs, next);
  }
  const part = version.segments[segment];
  if (!part || !("text" in part)) return undefined;
  const run = { from: part.from, to: part.to, text: part.text };
  return segmentStatus(run, runs) === "available" ? replaceRunFix(base, runs, run) : undefined;
};
