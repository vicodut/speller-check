import { z } from "zod";

export const ReasoningEffort = z.enum(["none", "low", "medium", "high"]);
export type ReasoningEffort = z.infer<typeof ReasoningEffort>;

export const Settings = z.object({
  /** OpenAI-compatible base URL, including the version prefix (e.g. http://127.0.0.1:11434/v1). */
  baseUrl: z.url().transform((url) => url.replace(/\/+$/, "")),
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  dictionaryPath: z.string().min(1),
  /** Sent as `reasoning_effort` when set; `none` turns off thinking on models like qwen3. */
  reasoningEffort: ReasoningEffort.optional(),
});
export type Settings = z.infer<typeof Settings>;
