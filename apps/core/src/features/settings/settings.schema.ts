import { z } from "zod";

export const Settings = z.object({
  /** OpenAI-compatible base URL, including the version prefix (e.g. http://127.0.0.1:11434/v1). */
  baseUrl: z.url().transform((url) => url.replace(/\/+$/, "")),
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  dictionaryPath: z.string().min(1),
});
export type Settings = z.infer<typeof Settings>;
