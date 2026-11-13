import type { AppError } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { ok, type Result } from "../../shared/result";
import type { CallSample } from "./call-sample.util";
import type { SampleSink } from "./statistics.port";
import type { StatisticsEntry, StatisticsFile } from "./statistics-file.schema";
import { statisticsKey } from "./statistics-key.util";

type Store = {
  load(): Promise<Result<StatisticsFile | null, AppError>>;
  save(file: StatisticsFile): Promise<Result<void, AppError>>;
};

const EMPTY_FILE: StatisticsFile = { version: 1, removed: [], entries: [] };

/**
 * Keeps the model-call statistics in memory and writes them through after each change, one
 * write at a time. A missing or corrupt file starts empty; a failed write is logged by code and
 * the numbers stay in memory.
 */
export class StatisticsRecorder implements SampleSink {
  private readonly byKey = new Map<string, StatisticsEntry>();
  private readonly removedNames = new Map<string, string>();
  private writing: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: Store,
    private readonly logger: Logger,
  ) {}

  /** Reads the saved numbers, if any. Call once, before the first sample. */
  async load(): Promise<void> {
    const loaded = await this.store.load();
    if (!loaded.ok) {
      this.logger.error({ event: "statistics.load_failed", code: loaded.error.code });
      return;
    }
    for (const entry of loaded.value?.entries ?? []) {
      this.byKey.set(statisticsKey(entry.feature, entry.profileId, entry.model), entry);
    }
    for (const { profileId, name } of loaded.value?.removed ?? []) {
      this.removedNames.set(profileId, name);
    }
    this.logger.info({ event: "statistics.loaded", len: this.byKey.size });
  }

  record(samples: readonly CallSample[]): void {
    if (samples.length === 0) return;
    for (const sample of samples) this.apply(sample);
    this.logger.info({ event: "statistics.recorded", len: samples.length });
    void this.write();
  }

  /** Every entry, as stored; a copy, so callers can't change the statistics. */
  entries(): StatisticsEntry[] {
    return structuredClone([...this.byKey.values()]);
  }

  /**
   * A profile was deleted: keeps its last name, beside its rows. A profile with no rows keeps
   * nothing, so no name is stored for it.
   */
  markRemoved(profileId: string, name: string): void {
    const hasRows = [...this.byKey.values()].some((e) => e.profileId === profileId);
    if (!hasRows) return;
    this.removedNames.set(profileId, name);
    void this.write();
  }

  /** The last name kept for a deleted profile, if any. */
  removedName(profileId: string): string | undefined {
    return this.removedNames.get(profileId);
  }

  /**
   * Forgets every number and kept name. The empty file is saved first, and memory is cleared
   * only once it is written: a failed write returns its code and leaves everything as it was.
   */
  clear(): Promise<Result<void, AppError>> {
    return this.enqueue(async () => {
      const saved = await this.persist(EMPTY_FILE);
      if (!saved.ok) return saved;
      this.byKey.clear();
      this.removedNames.clear();
      this.logger.info({ event: "statistics.cleared" });
      return ok(undefined);
    });
  }

  /** Resolves once every write queued so far has finished (for shutdown and tests). */
  async flush(): Promise<void> {
    await this.writing;
  }

  private apply(sample: CallSample): void {
    const { feature, identity } = sample;
    const key = statisticsKey(feature, identity.profileId, identity.model);
    const entry = this.byKey.get(key) ?? {
      feature,
      profileId: identity.profileId,
      model: identity.model,
      local: identity.local,
      ok: [],
      failures: {},
    };
    entry.local = identity.local;
    if (sample.kind === "ok") {
      entry.ok.push([sample.letters, sample.ms, sample.words]);
    } else {
      entry.failures[sample.code] = (entry.failures[sample.code] ?? 0) + 1;
    }
    this.byKey.set(key, entry);
  }

  /** Queues a write of the current numbers behind any still running. */
  private write(): Promise<Result<void, AppError>> {
    return this.enqueue(() => this.persist(this.snapshot()));
  }

  /** Runs a task after every write queued so far, so no older write lands after it. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.writing.then(task);
    this.writing = next;
    return next;
  }

  private snapshot(): StatisticsFile {
    const removed = [...this.removedNames].map(([profileId, name]) => ({ profileId, name }));
    return { version: 1, removed, entries: this.entries() };
  }

  private async persist(file: StatisticsFile): Promise<Result<void, AppError>> {
    const saved = await this.store.save(file);
    if (!saved.ok) {
      this.logger.error({ event: "statistics.write_failed", code: saved.error.code });
      return saved;
    }
    return ok(undefined);
  }
}
