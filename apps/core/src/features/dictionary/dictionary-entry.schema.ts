import { z } from "zod";

export const DictionaryEntry = z.object({
  term: z.string().trim().min(1),
  note: z.string().optional(),
  /** Entries are case-sensitive unless this is set. */
  caseInsensitive: z.boolean().optional(),
});
export type DictionaryEntry = z.infer<typeof DictionaryEntry>;

export const DictionaryFile = z.object({
  entries: z.array(DictionaryEntry),
});
export type DictionaryFile = z.infer<typeof DictionaryFile>;
