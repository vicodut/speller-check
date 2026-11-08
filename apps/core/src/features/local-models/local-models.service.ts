import type {
  LocalModelState,
  LocalModelsView,
  LocalModelView,
  ManifestEntry,
  ModelManifest,
} from "@gc/protocol";
import { type AppError, appError, type ErrorCode } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import type { ModelDownloader } from "./model-downloader.service";
import type { ModelFiles } from "./model-files.repository";

/** The latest download, updated in place; one at a time. */
type Download = {
  readonly entry: ManifestEntry;
  readonly abort: AbortController;
  readonly settled: Promise<void>;
  step: "downloading" | "verifying" | "failed";
  completed: number;
  error: ErrorCode | null;
  running: boolean;
};

export type LocalModelsDeps = {
  readonly manifest: ModelManifest;
  readonly files: ModelFiles;
  readonly downloader: Pick<ModelDownloader, "download">;
  /** Whether a saved profile uses this manifest id as its model. */
  readonly inUse: (id: string) => boolean;
  /** This Mac's memory in bytes. */
  readonly memoryBytes: number;
  readonly logger: Logger;
};

/**
 * The curated local models: which are on disk, the download in progress, and deletion. A file
 * under its final name has been verified, so "ready" is just "that file exists at the promised
 * size". One download at a time; a failed one stays visible until the next attempt.
 */
export class LocalModels {
  private current: Download | null = null;

  constructor(private readonly deps: LocalModelsDeps) {}

  async view(): Promise<LocalModelsView> {
    const models = await Promise.all(this.deps.manifest.entries.map((e) => this.entryView(e)));
    return { memoryBytes: this.deps.memoryBytes, models };
  }

  /** Starts (or resumes) a download in the background; answers once it has started. */
  start(id: string): Result<void, AppError> {
    const entry = this.find(id);
    if (!entry) return err(appError("model_not_found"));
    if (this.current?.running) return err(appError("download_in_progress"));
    let settle = () => {};
    const settled = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const download: Download = {
      entry,
      abort: new AbortController(),
      settled,
      step: "downloading",
      completed: 0,
      error: null,
      running: true,
    };
    this.current = download;
    this.deps.logger.info({ event: "model.download_started" });
    void this.run(download).finally(settle);
    return ok(undefined);
  }

  /** Stops the running download; its partial file stays for a later resume. */
  cancel(): void {
    const download = this.current;
    if (!download?.running) return;
    this.current = null;
    download.abort.abort();
  }

  /** Deletes a model from disk, unless a profile uses it or it is being downloaded. */
  async remove(id: string): Promise<Result<void, AppError>> {
    const entry = this.find(id);
    if (!entry) return err(appError("model_not_found"));
    if (this.current?.running && this.current.entry.id === id) {
      return err(appError("download_in_progress"));
    }
    if (this.deps.inUse(id)) return err(appError("model_in_use"));
    try {
      await this.deps.files.removeFinal(entry.file);
      await this.deps.files.removePart(entry.file);
    } catch {
      return err(appError("model_file_failed"));
    }
    if (this.current?.entry.id === id) this.current = null;
    this.deps.logger.info({ event: "model.deleted" });
    return ok(undefined);
  }

  /** Resolves once the current download (if any) has ended; for tests. */
  whenSettled(): Promise<void> {
    return this.current?.settled ?? Promise.resolve();
  }

  private find(id: string): ManifestEntry | undefined {
    return this.deps.manifest.entries.find((e) => e.id === id);
  }

  private async entryView(entry: ManifestEntry): Promise<LocalModelView> {
    const { state, completed, error } = await this.stateOf(entry);
    const { ramBytes } = entry;
    return {
      id: entry.id,
      kind: entry.kind,
      name: entry.name,
      sizeBytes: entry.sizeBytes,
      ramBytes,
      fixtureScore: entry.fixtureScore,
      state,
      completed,
      error,
      ramWarning: ramBytes !== null && this.deps.memoryBytes < ramBytes,
      inUse: this.deps.inUse(entry.id),
    };
  }

  private async stateOf(
    entry: ManifestEntry,
  ): Promise<{ state: LocalModelState; completed: number; error: string | null }> {
    const download = this.current?.entry.id === entry.id ? this.current : null;
    if (download) {
      const { step, completed, error } = download;
      return { state: step, completed, error };
    }
    if ((await this.deps.files.finalSize(entry.file)) === entry.sizeBytes) {
      return { state: "ready", completed: entry.sizeBytes, error: null };
    }
    return {
      state: "absent",
      completed: (await this.deps.files.partSize(entry.file)) ?? 0,
      error: null,
    };
  }

  private async run(download: Download): Promise<void> {
    const started = Date.now();
    const result = await this.deps.downloader.download(download.entry, download.abort.signal, {
      progress: (completed) => {
        download.completed = completed;
      },
      verifying: () => {
        download.step = "verifying";
      },
    });
    download.running = false;
    if (result.ok) {
      this.current = null;
      this.deps.logger.info({ event: "model.download_done", ms: Date.now() - started });
    } else if (download.abort.signal.aborted) {
      this.deps.logger.info({ event: "model.download_cancelled", ms: Date.now() - started });
    } else {
      download.step = "failed";
      download.error = result.error.code;
      const event =
        result.error.code === "checksum_mismatch"
          ? "model.checksum_failed"
          : "model.download_failed";
      this.deps.logger.error({ event, code: result.error.code });
    }
  }
}
