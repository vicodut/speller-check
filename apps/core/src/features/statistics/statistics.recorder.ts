import type { AppError } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { ok, type Result } from "../../shared/result";
import type { CallSample } from "./call-sample.util";
import type { SampleSink } from "./statistics.port";
import type { StatisticsEntry, StatisticsFile } from "./statistics-file.schema";

type Store = {
  load(): Promise<Result<StatisticsFile | null, AppError>>;
  save(file: StatisticsFile): Promise<Result<void, AppError>>;
};

const keyOf = (feature: string, profileId: string, model: string): string =>
  JSON.stringify([feature, profileId, model]);

/**
 * Keeps the model-call statistics in memory and writes them through after each change, one
 * write at a time. A missing or corrupt file starts empty; a failed write is logged by code and
 * the numbers stay in memory.
 */
export class StatisticsRecorder implements SampleSink {
  private readonly byKey = new Map<string, StatisticsEntry>();
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
      this.byKey.set(keyOf(entry.feature, entry.profileId, entry.model), entry);
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

  /** Forgets every number and saves the empty file. */
  async clear(): Promise<Result<void, AppError>> {
    this.byKey.clear();
    this.logger.info({ event: "statistics.cleared" });
    return this.write();
  }

  /** Resolves once every write queued so far has finished (for shutdown and tests). */
  async flush(): Promise<void> {
    await this.writing;
  }

  private apply(sample: CallSample): void {
    const { feature, identity } = sample;
    const key = keyOf(feature, identity.profileId, identity.model);
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
      entry.ok.push([sample.letters, sample.ms]);
    } else {
      entry.failures[sample.code] = (entry.failures[sample.code] ?? 0) + 1;
    }
    this.byKey.set(key, entry);
  }

  /** Queues a write of the current numbers behind any still running. */
  private write(): Promise<Result<void, AppError>> {
    const next = this.writing.then(() => this.save());
    this.writing = next;
    return next;
  }

  private async save(): Promise<Result<void, AppError>> {
    const file: StatisticsFile = { version: 1, entries: this.entries() };
    const saved = await this.store.save(file);
    if (!saved.ok) {
      this.logger.error({ event: "statistics.write_failed", code: saved.error.code });
      return saved;
    }
    return ok(undefined);
  }
}
