import { z } from "zod";

/**
 * An Ollama model name as `ollama pull` takes it: `qwen3:8b`, `library/llama3.2:3b`,
 * `hf.co/org/repo:Q4_K_M`. Up to four path parts and an optional tag, each starting with a letter
 * or digit, so nothing like `..`, spaces or a URL can get through.
 */
export const OllamaModelName = z
  .string()
  .max(200)
  .regex(/^[A-Za-z0-9][\w.-]*(\/[A-Za-z0-9][\w.-]*){0,3}(:[A-Za-z0-9][\w.-]{0,127})?$/);

/** `POST /api/runtime/ollama/pull`: pull this model through Ollama. */
export const PullRequest = z.strictObject({ model: OllamaModelName });
export type PullRequest = z.infer<typeof PullRequest>;

/**
 * Where a pull is: `starting` (resolving the manifest), `downloading` (layers coming in),
 * `verifying` (checking and writing them), then `done` or `failed` with an error code.
 */
export const PullStep = z.enum(["starting", "downloading", "verifying", "done", "failed"]);
export type PullStep = z.infer<typeof PullStep>;

/** The latest pull, as the page shows it. Bytes are summed over every layer seen so far. */
export const OllamaPullView = z.strictObject({
  model: OllamaModelName,
  step: PullStep,
  completed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  /** Set when `step` is `failed`: `ollama_model_not_found`, `ollama_pull_failed`, … */
  error: z.string().min(1).nullable(),
});
export type OllamaPullView = z.infer<typeof OllamaPullView>;
