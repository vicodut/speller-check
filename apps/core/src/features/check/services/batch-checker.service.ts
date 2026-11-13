import type { AppError } from "../../../shared/errors";
import type { Logger } from "../../../shared/logger";
import { ok, type Result } from "../../../shared/result";
import { buildDictionaryContext, type DictionaryEntry, relevantEntries } from "../../dictionary";
import { type Provider, pinProvider } from "../../providers";
import { type SampleSink, samplesFromAttempts } from "../../statistics";
import type { CheckCache } from "./check-cache.service";
import { locateIssue } from "./issue-locator.service";
import { shiftIssue } from "./issue-offsets.service";
import { requestModelIssues } from "./model-issues.requester";
import { buildPrompt } from "./prompt-builder.service";
import type { Sentence } from "./sentence-segmenter.service";

export type Hashed = Sentence & { readonly hash: string };

export type BatchCheckDeps = {
  readonly provider: Provider;
  readonly cache: CheckCache;
  readonly logger: Logger;
  readonly stats: SampleSink;
};

/**
 * One model call for a batch of uncached sentences, with the sentences around them (`all`) as
 * context; stores each sentence's result in the cache.
 */
export const checkBatch = async (
  deps: BatchCheckDeps,
  targets: readonly Hashed[],
  all: readonly Hashed[],
  entries: readonly DictionaryEntry[],
): Promise<Result<null, AppError>> => {
  if (targets.length === 0) return ok(null);
  // One model for the whole batch (retry included) and its cache key, even if settings change.
  const provider = pinProvider(deps.provider);
  const context = neighbours(targets, all).map((s) => s.text);
  const batchText = [...targets.map((s) => s.text), ...context].join("\n");
  const messages = buildPrompt({
    sentences: targets.map((s) => s.text),
    context,
    dictionary: buildDictionaryContext(relevantEntries(entries, batchText)),
  });
  const timed = await requestModelIssues(provider, messages, deps.logger);
  deps.stats.record(
    samplesFromAttempts(timed.attempts, {
      feature: "check",
      identity: provider.identity,
      letters: targets.reduce((sum, s) => sum + s.text.length, 0),
    }),
  );
  if (!timed.result.ok) return timed.result;
  const modelIssues = timed.result;

  const located = modelIssues.value.flatMap((issue) => {
    const result = locateIssue(issue, targets);
    if (!result.ok) deps.logger.info({ event: "locate.dropped", code: result.error.code });
    return result.ok ? [result.value] : [];
  });
  for (const sentence of targets) {
    const own = located.filter((i) => i.start >= sentence.start && i.end <= sentence.end);
    deps.cache.set(
      provider.model,
      sentence.hash,
      own.map((i) => shiftIssue(i, -sentence.start)),
    );
  }
  return ok(null);
};

/** Sentences directly before or after a target that aren't targets themselves, in text order. */
const neighbours = (targets: readonly Hashed[], all: readonly Hashed[]): Hashed[] => {
  const targetSet = new Set(targets);
  return all.filter(
    (s, i) =>
      !targetSet.has(s) &&
      (targetSet.has(all[i - 1] as Hashed) || targetSet.has(all[i + 1] as Hashed)),
  );
};
