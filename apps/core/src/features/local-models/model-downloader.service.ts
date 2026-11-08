import type { ManifestEntry } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import { sha256File } from "./file-hash.util";
import type { ModelFiles } from "./model-files.repository";
import { classifyReply, planResume, rangeHeader } from "./resume.util";

export type DownloadHooks = {
  /** Bytes of the file on disk so far (including what an earlier attempt left). */
  progress(completed: number): void;
  /** All bytes are in; the SHA-256 is being checked. */
  verifying(): void;
};

/**
 * Downloads a manifest entry into the models folder: resumes a partial file with an HTTP Range
 * request, checks the SHA-256 before the file gets its final name, and deletes it on a mismatch.
 * The only code here that touches the network. `fetch` is injected so tests use a local server.
 */
export class ModelDownloader {
  constructor(
    private readonly files: ModelFiles,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async download(
    entry: ManifestEntry,
    signal: AbortSignal,
    hooks: DownloadHooks,
  ): Promise<Result<void, AppError>> {
    try {
      return await this.run(entry, signal, hooks);
    } catch {
      // A cancelled or interrupted download keeps its partial file, so the next one resumes.
      return err(appError(signal.aborted ? "download_cancelled" : "download_failed"));
    }
  }

  private async run(
    entry: ManifestEntry,
    signal: AbortSignal,
    hooks: DownloadHooks,
  ): Promise<Result<void, AppError>> {
    const plan = planResume((await this.files.partSize(entry.file)) ?? 0, entry.sizeBytes);
    if (plan.kind === "fetch") {
      if (plan.discard) await this.files.removePart(entry.file);
      const fetched = await this.fetchInto(entry, plan.offset, true, signal, hooks);
      if (!fetched.ok) return fetched;
    }
    hooks.verifying();
    if ((await sha256File(this.files.partPath(entry.file))) !== entry.sha256) {
      await this.files.removePart(entry.file);
      return err(appError("checksum_mismatch"));
    }
    await this.files.finalize(entry.file);
    return ok(undefined);
  }

  private async fetchInto(
    entry: ManifestEntry,
    offset: number,
    mayRestart: boolean,
    signal: AbortSignal,
    hooks: DownloadHooks,
  ): Promise<Result<void, AppError>> {
    const response = await this.fetcher(entry.url, { headers: rangeHeader(offset), signal });
    const action = classifyReply(
      response.status,
      response.headers.get("content-range"),
      offset,
      entry.sizeBytes,
    );
    if (action === "restart" && mayRestart) {
      await response.body?.cancel();
      await this.files.removePart(entry.file);
      return this.fetchInto(entry, 0, false, signal, hooks);
    }
    if (action === "restart" || action === "fail" || !response.body) {
      await response.body?.cancel();
      return err(appError("download_failed"));
    }
    const start = action === "append" ? offset : 0;
    const total = await this.write(entry, start, response.body, hooks);
    if (total === entry.sizeBytes) return ok(undefined);
    // Short: keep it, the next attempt resumes. Long: it can't be the file, drop it.
    if (total > entry.sizeBytes) await this.files.removePart(entry.file);
    return err(appError("download_failed"));
  }

  /** Streams the body into the partial file; answers the file's size afterwards. */
  private async write(
    entry: ManifestEntry,
    start: number,
    body: ReadableStream<Uint8Array>,
    hooks: DownloadHooks,
  ): Promise<number> {
    const writer = await this.files.openPart(entry.file, start > 0 ? "append" : "truncate");
    let total = start;
    hooks.progress(total);
    try {
      for await (const chunk of body) {
        await writer.write(chunk);
        total += chunk.byteLength;
        hooks.progress(total);
      }
    } finally {
      await writer.close();
    }
    return total;
  }
}
