import type { Issue } from "@gc/protocol";
import type { AppError } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import {
  buildDictionaryContext,
  type DictionaryEntry,
  filterDictionaryTerms,
  relevantEntries,
} from "../dictionary";
import type { Provider } from "../providers";
import type { CheckCache } from "./services/check-cache.service";
import { locateIssue } from "./services/issue-locator.service";
import { dropOverlaps, shiftIssue } from "./services/issue-offsets.service";
import { requestModelIssues } from "./services/model-issues.requester";
import { trimNeighbourEchoes } from "./services/neighbour-echo-trimmer.service";
import { buildPrompt } from "./services/prompt-builder.service";
import { hashSentence } from "./services/sentence-hasher.service";
import { type Sentence, segmentSentences } from "./services/sentence-segmenter.service";

export type DictionarySource = {
  load(): Promise<Result<DictionaryEntry[], AppError>>;
};

/** `version` is passed through untouched until reconcile lands (milestone 2). */
export type CheckInput = { readonly text: string; readonly version?: number };
export type CheckOutput = { readonly version?: number; readonly issues: Issue[] };

type Hashed = Sentence & { readonly hash: string };

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
    const entries = await this.dictionary.load();
    if (!entries.ok) return this.fail(entries.error);

    const sentences = segmentSentences(input.text).map((s) => ({
      ...s,
      hash: hashSentence(s.text),
    }));
    const misses = uniqueByHash(sentences.filter((s) => !this.isCached(s)));
    this.logger.info({ event: "cache.hit", len: sentences.length - misses.length });
    this.logger.info({ event: "cache.miss", len: misses.length });

    const checked = await this.checkSentences(misses, sentences, entries.value);
    if (!checked.ok) return this.fail(checked.error);

    const found = sentences.flatMap((s) => this.cachedIssues(s));
    const issues = this.resolveConflicts(filterDictionaryTerms(found, entries.value), input.text);
    this.logger.info({
      event: "check.done",
      ms: performance.now() - startedAt,
      len: issues.length,
    });
    return ok(input.version === undefined ? { issues } : { version: input.version, issues });
  }

  /** One result holds no two issues on overlapping ranges or fixing the same spot twice. */
  private resolveConflicts(found: readonly Issue[], text: string): Issue[] {
    const disjoint = dropOverlaps(found);
    const issues = trimNeighbourEchoes(disjoint, text);
    this.logDropped("issues.overlap_dropped", found.length - disjoint.length);
    this.logDropped("issues.echo_dropped", disjoint.length - issues.length);
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

  /** One batched model call for the uncached sentences; stores each sentence's result in the cache. */
  private async checkSentences(
    targets: readonly Hashed[],
    all: readonly Hashed[],
    entries: readonly DictionaryEntry[],
  ): Promise<Result<null, AppError>> {
    if (targets.length === 0) return ok(null);
    const context = neighbours(targets, all).map((s) => s.text);
    const batchText = [...targets.map((s) => s.text), ...context].join("\n");
    const messages = buildPrompt({
      sentences: targets.map((s) => s.text),
      context,
      dictionary: buildDictionaryContext(relevantEntries(entries, batchText)),
    });
    const modelIssues = await requestModelIssues(this.provider, messages, this.logger);
    if (!modelIssues.ok) return modelIssues;

    const located = modelIssues.value.flatMap((issue) => {
      const result = locateIssue(issue, targets);
      if (!result.ok) this.logger.info({ event: "locate.dropped", code: result.error.code });
      return result.ok ? [result.value] : [];
    });
    for (const sentence of targets) {
      const own = located.filter((i) => i.start >= sentence.start && i.end <= sentence.end);
      this.cache.set(
        this.provider.model,
        sentence.hash,
        own.map((i) => shiftIssue(i, -sentence.start)),
      );
    }
    return ok(null);
  }

  private fail(error: AppError): Result<never, AppError> {
    this.logger.error({ event: "check.failed", code: error.code });
    return err(error);
  }
}

const uniqueByHash = (sentences: readonly Hashed[]): Hashed[] => [
  ...new Map(sentences.map((s) => [s.hash, s] as const)).values(),
];

/** Sentences directly before or after a target that aren't targets themselves, in text order. */
const neighbours = (targets: readonly Hashed[], all: readonly Hashed[]): Hashed[] => {
  const targetSet = new Set(targets);
  return all.filter(
    (s, i) =>
      !targetSet.has(s) &&
      (targetSet.has(all[i - 1] as Hashed) || targetSet.has(all[i + 1] as Hashed)),
  );
};
