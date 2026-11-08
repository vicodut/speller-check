import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ManifestEntry, ModelManifest } from "@gc/protocol";
import { Logger } from "../../shared/logger";
import { LocalModels } from "./local-models.service";
import { ModelDownloader } from "./model-downloader.service";
import { ModelFiles } from "./model-files.repository";

const BODY = Buffer.from("model-bytes".repeat(50));
const entry = (id: string, patch: Partial<ManifestEntry> = {}): ManifestEntry => ({
  id,
  kind: "model",
  name: id,
  file: `${id}.gguf`,
  url: "https://example.invalid/x",
  sizeBytes: BODY.length,
  sha256: createHash("sha256").update(BODY).digest("hex"),
  ramBytes: 8_000,
  fixtureScore: null,
  ...patch,
});

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gc-models-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const setup = (opts: { used?: string[]; memory?: number; body?: Buffer; sha?: string } = {}) => {
  const manifest: ModelManifest = {
    version: 1,
    entries: [entry("a", opts.sha ? { sha256: opts.sha } : {}), entry("b", { ramBytes: 2_000 })],
  };
  const files = new ModelFiles(dir);
  // The network is replaced by an injected fetch, so no test reaches out.
  const fetcher = (async () => new Response(opts.body ?? BODY)) as unknown as typeof fetch;
  const models = new LocalModels({
    manifest,
    files,
    downloader: new ModelDownloader(files, fetcher),
    inUse: (id) => (opts.used ?? []).includes(id),
    memoryBytes: opts.memory ?? 16_000,
    logger: new Logger(() => {}),
  });
  return { models, files };
};

const stateOf = async (models: LocalModels, id: string) =>
  (await models.view()).models.find((m) => m.id === id);

describe("LocalModels", () => {
  test("lists the manifest entries as absent at first", async () => {
    const { models } = setup();
    const view = await models.view();
    expect(view.memoryBytes).toBe(16_000);
    expect(view.models.map((m) => [m.id, m.state, m.completed])).toEqual([
      ["a", "absent", 0],
      ["b", "absent", 0],
    ]);
  });

  test("warns only for a model that needs more memory than the Mac has", async () => {
    const { models } = setup({ memory: 4_000 });
    expect((await stateOf(models, "a"))?.ramWarning).toBe(true);
    expect((await stateOf(models, "b"))?.ramWarning).toBe(false);
  });

  test("downloads and verifies, then reports ready (also after a restart)", async () => {
    const { models, files } = setup();
    expect(models.start("a").ok).toBe(true);
    await models.whenSettled();
    expect((await stateOf(models, "a"))?.state).toBe("ready");
    const again = new LocalModels({
      manifest: { version: 1, entries: [entry("a")] },
      files,
      downloader: new ModelDownloader(files),
      inUse: () => false,
      memoryBytes: 1,
      logger: new Logger(() => {}),
    });
    expect((await stateOf(again, "a"))?.state).toBe("ready");
  });

  test("a checksum mismatch fails, shows the error and leaves no file", async () => {
    const { models } = setup({ sha: "f".repeat(64) });
    models.start("a");
    await models.whenSettled();
    const view = await stateOf(models, "a");
    expect([view?.state, view?.error]).toEqual(["failed", "checksum_mismatch"]);
    expect(await stat(join(dir, "a.gguf")).catch(() => null)).toBeNull();
    expect(await stat(join(dir, "a.gguf.part")).catch(() => null)).toBeNull();
  });

  test("shows a partial file as absent with its bytes, ready to resume", async () => {
    const { models } = setup();
    await writeFile(join(dir, "a.gguf.part"), BODY.subarray(0, 100));
    const view = await stateOf(models, "a");
    expect([view?.state, view?.completed]).toEqual(["absent", 100]);
  });

  test("refuses a second download while one runs, and an unknown id", async () => {
    const { models } = setup();
    models.start("a");
    const second = models.start("b");
    expect(second.ok ? null : second.error.code).toBe("download_in_progress");
    const unknown = models.start("zzz");
    expect(unknown.ok ? null : unknown.error.code).toBe("model_not_found");
    await models.whenSettled();
  });

  test("deletes a model on disk", async () => {
    const { models } = setup();
    models.start("a");
    await models.whenSettled();
    expect((await models.remove("a")).ok).toBe(true);
    expect((await stateOf(models, "a"))?.state).toBe("absent");
  });

  test("refuses to delete a model a profile uses", async () => {
    const { models } = setup({ used: ["a"] });
    models.start("a");
    await models.whenSettled();
    const removed = await models.remove("a");
    expect(removed.ok ? null : removed.error.code).toBe("model_in_use");
    expect((await stateOf(models, "a"))?.state).toBe("ready");
    expect((await stateOf(models, "a"))?.inUse).toBe(true);
  });

  test("refuses to delete a model that is downloading", async () => {
    const { models } = setup();
    models.start("a");
    const removed = await models.remove("a");
    expect(removed.ok ? null : removed.error.code).toBe("download_in_progress");
    await models.whenSettled();
  });
});
