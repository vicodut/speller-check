import { type Issue, isTextTooLong } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import { type DictionaryEntry, filterDictionaryTerms } from "../dictionary";
import type { Provider } from "../providers";
import { BATCH_MAX_CHARS, BATCH_MAX_SENTENCES } from "./check-limits.constants";
import { checkBatch, type Hashed } from "./services/batch-checker.service";
import type { CheckCache } from "./services/check-cache.service";
import { dropOverlaps, shiftIssue } from "./services/issue-offsets.service";
import { trimNeighbourEchoes } from "./services/neighbour-echo-trimmer.service";
import { splitBatches } from "./services/sentence-batcher.service";
import { hashSentence } from "./services/sentence-hasher.service";
import { segmentSentences } from "./services/sentence-segmenter.service";

export type DictionarySource = {
  load(): Promise<Result<DictionaryEntry[], AppError>>;
};

/**
 * `version` is passed through untouched. A check needing several batches calls `onPartial` after
 * every batch but the last, with all issues found so far, then asks `isSuperseded`: true drops
 * the remaining batches and the output says `superseded`. Both are optional (the CLI uses none).
 */
export type CheckInput = {
  readonly text: string;
  readonly version?: number;
  readonly onPartial?: (issues: Issue[]) => void;
  readonly isSuperseded?: () => boolean;
};
export type CheckOutput = {
  readonly version?: number;
  readonly issues: Issue[];
  readonly superseded?: true;
};

type Run = {
  readonly input: CheckInput;
  readonly sentences: readonly Hashed[];
  readonly entries: readonly DictionaryEntry[];
};

const BATCH_LIMITS = { maxSentences: BATCH_MAX_SENTENCES, maxChars: BATCH_MAX_CHARS };

export class CheckService {
  constructor(
    private readonly provider: Provider,
    private readonly cache: CheckCache,
    private readonly dictionary: DictionarySource,
    private readonly logger: Logger,
  ) {}

  async check(input: CheckInput): Promise<Result<CheckOutput, AppError>> {
    const startedAt = performance.now();
    this.logger.info({ event: "check.start", len: input.text.length });
    if (isTextTooLong(input.text)) {
      this.logger.error({ event: "check.failed", code: "text_too_long", len: input.text.length });
      return err(appError("text_too_long"));
    }
    const entries = await this.dictionary.load();
    if (!entries.ok) return this.fail(entries.error);

    const sentences = segmentSentences(input.text).map((s) => ({
      ...s,
      hash: hashSentence(s.text),
    }));
    const run: Run = { input, sentences, entries: entries.value };
    const superseded = await this.checkBatches(run);
    if (!superseded.ok) return this.fail(superseded.error);

    const issues = this.collect(run, true);
    const ms = performance.now() - startedAt;
    this.logger.info({ event: "check.done", ms, len: issues.length });
    const output = superseded.value ? { issues, superseded: true as const } : { issues };
    return ok(input.version === undefined ? output : { version: input.version, ...output });
  }

  /** Checks uncached sentences batch by batch; `true` when the remaining batches were dropped. */
  private async checkBatches(run: Run): Promise<Result<boolean, AppError>> {
    const misses = uniqueByHash(run.sentences.filter((s) => !this.isCached(s)));
    this.logger.info({ event: "cache.hit", len: run.sentences.length - misses.length });
    this.logger.info({ event: "cache.miss", len: misses.length });
    const batches = splitBatches(misses, BATCH_LIMITS);
    if (batches.length > 1) this.logger.info({ event: "check.batches", len: batches.length });
    const deps = { provider: this.provider, cache: this.cache, logger: this.logger };
    for (const [index, batch] of batches.entries()) {
      const startedAt = performance.now();
      const checked = await checkBatch(deps, batch, run.sentences, run.entries);
      if (!checked.ok) return checked;
      if (batches.length === 1) break;
      const ms = performance.now() - startedAt;
      this.logger.info({ event: "check.batch_done", ms, len: batch.length });
      const left = batches.length - index - 1;
      if (left === 0) break;
      run.input.onPartial?.(this.collect(run, false));
      if (run.input.isSuperseded?.()) {
        this.logger.info({ event: "check.batches_dropped", len: left });
        return ok(true);
      }
    }
    return ok(false);
  }

  /** All issues found so far in the run's text (sentences not checked yet have none). */
  private collect(run: Run, final: boolean): Issue[] {
    const found = run.sentences.flatMap((s) => this.cachedIssues(s));
    const kept = filterDictionaryTerms(found, run.entries);
    return this.resolveConflicts(kept, run.input.text, final);
  }

  /** One result holds no two issues on overlapping ranges or fixing the same spot twice. */
  private resolveConflicts(found: readonly Issue[], text: string, log: boolean): Issue[] {
    const disjoint = dropOverlaps(found);
    const issues = trimNeighbourEchoes(disjoint, text);
    if (log) {
      this.logDropped("issues.overlap_dropped", found.length - disjoint.length);
      this.logDropped("issues.echo_dropped", disjoint.length - issues.length);
    }
    return issues;
  }

  private logDropped(event: "issues.overlap_dropped" | "issues.echo_dropped", len: number): void {
    if (len > 0) this.logger.info({ event, len });
  }

  private isCached(sentence: Hashed): boolean {
    return this.cache.get(this.provider.model, sentence.hash) !== undefined;
  }

  private cachedIssues(sentence: Hashed): Issue[] {
    const issues = this.cache.get(this.provider.model, sentence.hash) ?? [];
    return issues.map((issue) => shiftIssue(issue, sentence.start));
  }

  private fail(error: AppError): Result<never, AppError> {
    this.logger.error({ event: "check.failed", code: error.code });
    return err(error);
  }
}

const uniqueByHash = (sentences: readonly Hashed[]): Hashed[] => [
  ...new Map(sentences.map((s) => [s.hash, s] as const)).values(),
];
