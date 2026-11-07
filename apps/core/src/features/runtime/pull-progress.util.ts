import type { PullStep } from "@gc/protocol";
import { z } from "zod";

const Bytes = z.number().int().nonnegative();

/** One line of Ollama's `POST /api/pull` NDJSON stream. Unknown fields are ignored. */
const StatusLine = z.object({
  status: z.string(),
  digest: z.string().optional(),
  total: Bytes.optional(),
  completed: Bytes.optional(),
});
const ErrorLine = z.object({ error: z.string() });
const PullLineSchema = z.union([ErrorLine, StatusLine]);
export type PullLine = z.infer<typeof PullLineSchema>;

/** Parses one NDJSON line; null when it isn't a line Ollama would send. */
export const parsePullLine = (text: string): PullLine | null => {
  try {
    const parsed = PullLineSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/** Where a pull is so far. `layers`: each layer's latest bytes, keyed by digest. */
export type PullProgress = {
  readonly step: Exclude<PullStep, "failed">;
  readonly layers: Readonly<Record<string, { total: number; completed: number }>>;
  readonly completed: number;
  readonly total: number;
};

export const INITIAL_PROGRESS: PullProgress = {
  step: "starting",
  layers: {},
  completed: 0,
  total: 0,
};

const sum = (layers: PullProgress["layers"]) => {
  let completed = 0;
  let total = 0;
  for (const layer of Object.values(layers)) {
    completed += layer.completed;
    total += layer.total;
  }
  return { completed, total };
};

/**
 * Folds one status line into the progress. Ollama reports each layer on its own (`digest`,
 * `total`, `completed`), then `verifying sha256 digest`, `writing manifest` and `success`.
 * Error lines are handled by the caller.
 */
export const applyPullLine = (progress: PullProgress, line: PullLine): PullProgress => {
  if ("error" in line) return progress;
  if (line.status === "success") return { ...progress, step: "done", completed: progress.total };
  if (line.digest && line.total !== undefined) {
    const total = line.total;
    const completed = Math.min(line.completed ?? 0, total);
    const layers = { ...progress.layers, [line.digest]: { total, completed } };
    return { step: "downloading", layers, ...sum(layers) };
  }
  if (line.status === "pulling manifest") return progress;
  return { ...progress, step: "verifying" };
};
