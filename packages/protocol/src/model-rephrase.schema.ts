import { z } from "zod";

/** Sentence numbers as shown in the prompt (1-based). */
const SentenceNumbers = z.array(z.number().int().positive()).min(1);

/** One segment as returned by the model: sentence numbers, never offsets. */
export const ModelRephraseSegment = z.union([
  z.object({ sentences: SentenceNumbers, keep: z.literal(true) }),
  z.object({ sentences: SentenceNumbers, text: z.string() }),
]);
export type ModelRephraseSegment = z.infer<typeof ModelRephraseSegment>;

/** "fr", "French", "fr-FR"… count as French; anything else as English. */
const LooseLanguage = z
  .unknown()
  .optional()
  .transform((value) =>
    typeof value === "string" && value.trim().toLowerCase().startsWith("fr") ? "fr" : "en",
  );

/**
 * The model's reply for one tone. Segments stay unknown here: the core validates them
 * against its own sentence split.
 */
export const ModelRephraseResponse = z.object({
  language: LooseLanguage,
  segments: z.array(z.unknown()),
});
export type ModelRephraseResponse = z.infer<typeof ModelRephraseResponse>;
