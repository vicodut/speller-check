import { ReasoningEffort } from "@gc/protocol";
import { z } from "zod";

export const DEFAULT_PORT = 7341;

/** A TCP port given as a decimal string (from the environment), 1–65535. */
const PortFromEnv = z
  .string()
  .regex(/^\d{1,5}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(65535));

/** What `core serve` and `core token` need; loadable without any model settings. */
export const TransportSettings = z.object({
  port: PortFromEnv.default(DEFAULT_PORT),
  /** File holding the per-install token clients send in `hello`. */
  tokenPath: z.string().min(1),
});
export type TransportSettings = z.infer<typeof TransportSettings>;

export const Settings = TransportSettings.extend({
  /** OpenAI-compatible base URL, including the version prefix (e.g. http://127.0.0.1:11434/v1). */
  baseUrl: z.url().transform((url) => url.replace(/\/+$/, "")),
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  dictionaryPath: z.string().min(1),
  reasoningEffort: ReasoningEffort.optional(),
});
export type Settings = z.infer<typeof Settings>;
