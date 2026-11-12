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
  /** File holding the per-install token clients prove in the handshake. */
  tokenPath: z.string().min(1),
});
export type TransportSettings = z.infer<typeof TransportSettings>;

/** One model setup: where to send requests and how. The env vars or the active profile give it. */
export const ModelConfig = z.object({
  /** OpenAI-compatible base URL, including the version prefix (e.g. http://127.0.0.1:11434/v1). */
  baseUrl: z.url().transform((url) => url.replace(/\/+$/, "")),
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  reasoningEffort: ReasoningEffort.optional(),
});
export type ModelConfig = z.infer<typeof ModelConfig>;

/** `core check` and the benchmark: the model comes from env vars only. */
export const Settings = TransportSettings.extend({
  ...ModelConfig.shape,
  dictionaryPath: z.string().min(1),
});
export type Settings = z.infer<typeof Settings>;

/**
 * `core serve`: the model comes from the saved profiles, unless `GC_*` env vars give one
 * (`envModel`), which then overrides them all.
 */
export const ServeSettings = TransportSettings.extend({
  dictionaryPath: z.string().min(1),
  settingsPath: z.string().min(1),
  envModel: ModelConfig.nullable(),
});
export type ServeSettings = z.infer<typeof ServeSettings>;
