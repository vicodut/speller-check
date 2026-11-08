import { z } from "zod";

/** An https URL, so a manifest can't point a download at a local file or a plain-text server. */
const HttpsUrl = z
  .string()
  .max(2000)
  .refine((value) => URL.canParse(value) && new URL(value).protocol === "https:");

/** A file name inside the models folder: no path separators, no leading dot. */
export const ModelFileName = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);

/** How a curated model did on the fixture runs: `passed` of `total` checks right. */
export const FixtureScore = z.strictObject({
  passed: z.number().int().nonnegative(),
  total: z.number().int().positive(),
});
export type FixtureScore = z.infer<typeof FixtureScore>;

/**
 * One downloadable file of the release's manifest. `model` entries are GGUF weights; the
 * `server` entry is the llama-server build. `ramBytes` is what a model needs to run (null for
 * the server); `fixtureScore` is null for a candidate not benchmarked yet.
 */
export const ManifestEntry = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
  kind: z.enum(["model", "server"]),
  name: z.string().min(1).max(100),
  file: ModelFileName,
  url: HttpsUrl,
  sizeBytes: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  ramBytes: z.number().int().positive().nullable(),
  fixtureScore: FixtureScore.nullable(),
});
export type ManifestEntry = z.infer<typeof ManifestEntry>;

/** The manifest shipped inside the release. The core never fetches a remote one. */
export const ModelManifest = z
  .strictObject({ version: z.literal(1), entries: z.array(ManifestEntry).min(1).max(10) })
  .refine((m) => new Set(m.entries.map((e) => e.id)).size === m.entries.length, {
    message: "duplicate id",
  })
  .refine((m) => new Set(m.entries.map((e) => e.file)).size === m.entries.length, {
    message: "duplicate file",
  })
  .refine((m) => m.entries.filter((e) => e.kind === "server").length <= 1, {
    message: "more than one server",
  });
export type ModelManifest = z.infer<typeof ModelManifest>;

/** `absent` (maybe with a partial file to resume), `downloading`, `verifying`, `ready`, `failed`. */
export const LocalModelState = z.enum(["absent", "downloading", "verifying", "ready", "failed"]);
export type LocalModelState = z.infer<typeof LocalModelState>;

export const LocalModelView = z.strictObject({
  id: z.string(),
  kind: z.enum(["model", "server"]),
  name: z.string(),
  sizeBytes: z.number().int().positive(),
  ramBytes: z.number().int().positive().nullable(),
  fixtureScore: FixtureScore.nullable(),
  state: LocalModelState,
  /** Bytes on disk or received so far (a partial file waits for a resume). */
  completed: z.number().int().nonnegative(),
  /** Set when `state` is `failed`: `checksum_mismatch`, `download_failed`, … */
  error: z.string().min(1).nullable(),
  /** This Mac has less memory than the model needs. */
  ramWarning: z.boolean(),
  /** A profile uses it, so it can't be deleted. */
  inUse: z.boolean(),
});
export type LocalModelView = z.infer<typeof LocalModelView>;

/** `GET /api/local-models`: this Mac's memory and the curated files with their state. */
export const LocalModelsView = z.strictObject({
  memoryBytes: z.number().int().positive(),
  models: z.array(LocalModelView),
});
export type LocalModelsView = z.infer<typeof LocalModelsView>;
