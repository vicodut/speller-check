import {
  type ModelRephraseSegment,
  ModelRephraseVersion,
  type RephraseSegment,
  RephraseTone,
  type RephraseVersion,
} from "@gc/protocol";
import type { Sentence } from "../../check";

export type ValidatedVersions = {
  readonly versions: RephraseVersion[];
  /** Versions dropped for an invalid shape, a repeated tone or bad sentence coverage. */
  readonly dropped: number;
};

/** The original text a run of sentences covers, as written in the passage. */
const runText = (sentences: readonly Sentence[], from: number, to: number): string =>
  sentences
    .slice(from, to + 1)
    .map((s) => s.text)
    .join(" ");

/** Maps one model segment to a 0-based run if its sentence numbers are exactly `next`, `next+1`… */
const toSegment = (
  segment: ModelRephraseSegment,
  next: number,
  sentences: readonly Sentence[],
): RephraseSegment | undefined => {
  const consecutive = segment.sentences.every((n, i) => n === next + i);
  const from = next - 1;
  const to = from + segment.sentences.length - 1;
  if (!consecutive || to >= sentences.length) return undefined;
  if ("keep" in segment) return { from, to, keep: true };
  const text = segment.text.trim();
  if (text.length === 0) return undefined;
  return text === runText(sentences, from, to) ? { from, to, keep: true } : { from, to, text };
};

/** Segments covering every sentence exactly once, in order; undefined otherwise. */
const toSegments = (
  segments: readonly ModelRephraseSegment[],
  sentences: readonly Sentence[],
): RephraseSegment[] | undefined => {
  const out: RephraseSegment[] = [];
  let next = 1;
  for (const segment of segments) {
    const mapped = toSegment(segment, next, sentences);
    if (!mapped) return undefined;
    out.push(mapped);
    next = mapped.to + 2;
  }
  return next === sentences.length + 1 ? out : undefined;
};

/**
 * Validates the model's versions against the core's own sentence split. Invalid versions are
 * dropped (and counted); the rest come back once per tone, in tone order.
 */
export const validateVersions = (
  raw: readonly unknown[],
  sentences: readonly Sentence[],
): ValidatedVersions => {
  const byTone = new Map<RephraseTone, RephraseVersion>();
  for (const item of raw) {
    const parsed = ModelRephraseVersion.safeParse(item);
    if (!parsed.success || byTone.has(parsed.data.tone)) continue;
    const segments = toSegments(parsed.data.segments, sentences);
    if (segments) byTone.set(parsed.data.tone, { tone: parsed.data.tone, segments });
  }
  const versions = RephraseTone.options.flatMap((tone) => byTone.get(tone) ?? []);
  return { versions, dropped: raw.length - versions.length };
};
