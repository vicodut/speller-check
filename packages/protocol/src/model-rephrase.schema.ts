import { z } from "zod";
import { RephraseTone } from "./rephrase.schema";

/** Sentence numbers as shown in the prompt (1-based). */
const SentenceNumbers = z.array(z.number().int().positive()).min(1);

/** One segment as returned by the model: sentence numbers, never offsets. */
export const ModelRephraseSegment = z.union([
  z.object({ sentences: SentenceNumbers, keep: z.literal(true) }),
  z.object({ sentences: SentenceNumbers, text: z.string() }),
]);
export type ModelRephraseSegment = z.infer<typeof ModelRephraseSegment>;

export const ModelRephraseVersion = z.object({
  tone: RephraseTone,
  segments: z.array(ModelRephraseSegment),
});
export type ModelRephraseVersion = z.infer<typeof ModelRephraseVersion>;

/** "fr", "French", "fr-FR"… count as French; anything else as English. */
const LooseLanguage = z
  .unknown()
  .optional()
  .transform((value) =>
    typeof value === "string" && value.trim().toLowerCase().startsWith("fr") ? "fr" : "en",
  );

/**
 * The model's reply envelope. Versions stay unknown here: each one is validated on its own,
 * so one bad version doesn't sink the others.
 */
export const ModelRephraseResponse = z.object({
  language: LooseLanguage,
  versions: z.array(z.unknown()),
});
export type ModelRephraseResponse = z.infer<typeof ModelRephraseResponse>;
