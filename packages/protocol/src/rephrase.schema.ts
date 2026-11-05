import { z } from "zod";

/** The four tones, in display order. */
export const RephraseTone = z.enum(["professional", "casual", "concise", "friendlier"]);
export type RephraseTone = z.infer<typeof RephraseTone>;

/** Tones asked for in one request: at least one, each at most once. */
export const RephraseTones = z
  .array(RephraseTone)
  .min(1)
  .refine((tones) => new Set(tones).size === tones.length, { message: "tones must be unique" });

export const RephraseLanguage = z.enum(["en", "fr"]);
export type RephraseLanguage = z.infer<typeof RephraseLanguage>;

/** A span of the field text (UTF-16 offsets, `end` exclusive). */
const Span = z
  .object({ start: z.number().int().nonnegative(), end: z.number().int().nonnegative() })
  .refine((span) => span.end > span.start, { message: "end must be greater than start" });

/** One sentence of the passage, located by the core's own sentence split. */
export const RephraseSentence = z.object({
  text: z.string().min(1),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});
export type RephraseSentence = z.infer<typeof RephraseSentence>;

const SentenceRun = {
  /** First sentence index covered (0-based into `sentences`). */
  from: z.number().int().nonnegative(),
  /** Last sentence index covered, inclusive. */
  to: z.number().int().nonnegative(),
};

/** A run of consecutive sentences, either kept as written or rewritten as one text. */
export const RephraseSegment = z
  .union([
    z.object({ ...SentenceRun, keep: z.literal(true) }),
    z.object({ ...SentenceRun, text: z.string().trim().min(1) }),
  ])
  .refine((segment) => segment.to >= segment.from, { message: "to must not be before from" });
export type RephraseSegment = z.infer<typeof RephraseSegment>;

export const RephraseVersion = z.object({
  tone: RephraseTone,
  segments: z.array(RephraseSegment).min(1),
});
export type RephraseVersion = z.infer<typeof RephraseVersion>;

/**
 * One tone of the passage at the caret, sent as soon as it is ready. Each one carries the
 * passage and its sentences, so it can be shown on its own.
 */
export const RephraseToneResult = RephraseVersion.extend({
  passage: Span,
  sentences: z.array(RephraseSentence).min(1),
  language: RephraseLanguage,
});
export type RephraseToneResult = z.infer<typeof RephraseToneResult>;
