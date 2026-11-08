import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ManifestEntry } from "@gc/protocol";
import { ModelDownloader } from "./model-downloader.service";
import { ModelFiles } from "./model-files.repository";

const BODY = Buffer.from("0123456789".repeat(100)); // 1000 bytes
const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");

type Behaviour = "range" | "ignore-range" | "always-416" | "drop-midway";

let dir = "";
let server: ReturnType<typeof Bun.serve>;
let behaviour: Behaviour;
let ranges: (string | null)[];

const entry = (patch: Partial<ManifestEntry> = {}): ManifestEntry => ({
  id: "m",
  kind: "model",
  name: "Test",
  file: "m.gguf",
  url: `http://127.0.0.1:${server.port}/m.gguf`,
  sizeBytes: BODY.length,
  sha256: sha(BODY),
  ramBytes: 1,
  fixtureScore: null,
  ...patch,
});

const serve = (request: Request): Response => {
  const range = request.headers.get("range");
  ranges.push(range);
  if (behaviour === "always-416" && range) return new Response(null, { status: 416 });
  if (behaviour === "drop-midway") {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(BODY.subarray(0, 300));
        setTimeout(() => controller.error(new Error("cut")), 20);
      },
    });
    return new Response(stream, { headers: { "content-length": String(BODY.length) } });
  }
  const from = behaviour === "range" && range ? Number(/bytes=(\d+)-/.exec(range)?.[1]) : 0;
  if (from === 0) return new Response(BODY);
  return new Response(BODY.subarray(from), {
    status: 206,
    headers: { "content-range": `bytes ${from}-${BODY.length - 1}/${BODY.length}` },
  });
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gc-dl-"));
  behaviour = "range";
  ranges = [];
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: serve });
});
afterEach(async () => {
  await server.stop(true);
  await rm(dir, { recursive: true, force: true });
});

const run = (e: ManifestEntry, signal = new AbortController().signal) => {
  const progress: number[] = [];
  let verified = false;
  const files = new ModelFiles(dir);
  const result = new ModelDownloader(files).download(e, signal, {
    progress: (n) => progress.push(n),
    verifying: () => {
      verified = true;
    },
  });
  return result.then((r) => ({ r, progress, verified: () => verified }));
};

const exists = (name: string) =>
  stat(join(dir, name)).then(
    () => true,
    () => false,
  );

describe("ModelDownloader", () => {
  test("downloads, reports progress, verifies and gives the file its final name", async () => {
    const { r, progress, verified } = await run(entry());
    expect(r.ok).toBe(true);
    expect(progress.at(-1)).toBe(1000);
    expect(verified()).toBe(true);
    expect(await readFile(join(dir, "m.gguf"))).toEqual(BODY);
    expect(await exists("m.gguf.part")).toBe(false);
    expect(ranges).toEqual([null]);
  });

  test("resumes a partial file with a Range request", async () => {
    await writeFile(join(dir, "m.gguf.part"), BODY.subarray(0, 400));
    const { r, progress } = await run(entry());
    expect(r.ok).toBe(true);
    expect(ranges).toEqual(["bytes=400-"]);
    expect(progress[0]).toBe(400);
    expect(await readFile(join(dir, "m.gguf"))).toEqual(BODY);
  });

  test("starts over when the server ignores Range", async () => {
    behaviour = "ignore-range";
    await writeFile(join(dir, "m.gguf.part"), BODY.subarray(0, 400));
    const { r } = await run(entry());
    expect(r.ok).toBe(true);
    expect(await readFile(join(dir, "m.gguf"))).toEqual(BODY);
  });

  test("starts over after a 416", async () => {
    behaviour = "always-416";
    await writeFile(join(dir, "m.gguf.part"), BODY.subarray(0, 400));
    const { r } = await run(entry());
    expect(r.ok).toBe(true);
    expect(ranges).toEqual(["bytes=400-", null]);
  });

  test("only verifies a partial file that is already complete", async () => {
    await writeFile(join(dir, "m.gguf.part"), BODY);
    const { r } = await run(entry());
    expect(r.ok).toBe(true);
    expect(ranges).toEqual([]);
  });

  test("a checksum mismatch deletes the file and fails with checksum_mismatch", async () => {
    const { r } = await run(entry({ sha256: "0".repeat(64) }));
    expect(r.ok ? null : r.error.code).toBe("checksum_mismatch");
    expect(await exists("m.gguf")).toBe(false);
    expect(await exists("m.gguf.part")).toBe(false);
  });

  test("a corrupt partial file is caught after the resume", async () => {
    await writeFile(join(dir, "m.gguf.part"), Buffer.alloc(400, 1));
    const { r } = await run(entry());
    expect(r.ok ? null : r.error.code).toBe("checksum_mismatch");
    expect(await exists("m.gguf.part")).toBe(false);
  });

  test("an interrupted download keeps its partial file and then resumes", async () => {
    behaviour = "drop-midway";
    const first = await run(entry());
    expect(first.r.ok ? null : first.r.error.code).toBe("download_failed");
    const kept = (await stat(join(dir, "m.gguf.part"))).size;
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThan(1000);
    behaviour = "range";
    const second = await run(entry());
    expect(second.r.ok).toBe(true);
    expect(ranges.at(-1)).toBe(`bytes=${kept}-`);
    expect(await readFile(join(dir, "m.gguf"))).toEqual(BODY);
  });

  test("a non-success status fails without writing a file", async () => {
    const { r } = await run(entry({ url: `http://127.0.0.1:${server.port}/m.gguf`, sizeBytes: 5 }));
    expect(r.ok).toBe(false);
    expect(await exists("m.gguf")).toBe(false);
  });

  test("a cancelled download answers download_cancelled", async () => {
    const abort = new AbortController();
    abort.abort();
    const { r } = await run(entry(), abort.signal);
    expect(r.ok ? null : r.error.code).toBe("download_cancelled");
  });
});
