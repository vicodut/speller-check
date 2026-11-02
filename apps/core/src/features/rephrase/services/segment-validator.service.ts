import { ModelRephraseSegment, type RephraseSegment } from "@gc/protocol";
import type { Sentence } from "../../check";

/** The original text a run of sentences covers, as written in the passage. */
const runText = (sentences: readonly Sentence[], from: number, to: number): string =>
  sentences
    .slice(from, to + 1)
    .map((s) => s.text)
    .join(" ");

/** Maps one model segment to a 0-based run if its sentence numbers are exactly `next`, `next+1`… */
const toSegment = (
  raw: unknown,
  next: number,
  sentences: readonly Sentence[],
): RephraseSegment | undefined => {
  const parsed = ModelRephraseSegment.safeParse(raw);
  if (!parsed.success) return undefined;
  const segment = parsed.data;
  const consecutive = segment.sentences.every((n, i) => n === next + i);
  const from = next - 1;
  const to = from + segment.sentences.length - 1;
  if (!consecutive || to >= sentences.length) return undefined;
  if ("keep" in segment) return { from, to, keep: true };
  const text = segment.text.trim();
  if (text.length === 0) return undefined;
  return text === runText(sentences, from, to) ? { from, to, keep: true } : { from, to, text };
};

/**
 * Validates one tone's segments against the core's own sentence split: they must cover every
 * sentence exactly once, in order, with no empty rewrite. Undefined when they don't.
 */
export const validateSegments = (
  raw: readonly unknown[],
  sentences: readonly Sentence[],
): RephraseSegment[] | undefined => {
  const out: RephraseSegment[] = [];
  let next = 1;
  for (const item of raw) {
    const mapped = toSegment(item, next, sentences);
    if (!mapped) return undefined;
    out.push(mapped);
    next = mapped.to + 2;
  }
  return next === sentences.length + 1 ? out : undefined;
};
