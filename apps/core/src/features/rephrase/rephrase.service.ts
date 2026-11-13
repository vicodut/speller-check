import type { RephraseTone, RephraseToneResult } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import { type Provider, pinProvider, timedModelCall } from "../providers";
import { type Passage, selectPassage } from "./services/passage-selector.service";
import { hashPassage, type RephraseCache, type ToneReply } from "./services/rephrase-cache.service";
import {
  buildRephrasePrompt,
  REPHRASE_RETRY_MESSAGE,
} from "./services/rephrase-prompt-builder.service";
import { parseRephraseResponse } from "./services/rephrase-response-parser.service";
import { validateSegments } from "./services/segment-validator.service";
import { selectTones } from "./services/tone-selector.service";

/** The field text, the caret offset in it, and the tones asked for (all four if omitted). */
export type RephraseInput = {
  readonly text: string;
  readonly caret: number;
  readonly tones?: readonly RephraseTone[] | undefined;
};

/** Receives each validated tone as soon as it is ready; `signal` stops the remaining calls. */
export type RephraseRun = {
  readonly signal?: AbortSignal | undefined;
  onTone(tone: RephraseToneResult): void;
};

/**
 * Rephrases the passage at the caret with one short model call per tone asked for, in display
 * order.
 * A failed or invalid tone is skipped. Resolves to the number of tones sent. Offsets come from
 * the core's own sentence split; the model only answers by sentence number. Validated tones are
 * cached per model + passage + tone, so a repeat replays them at once and only calls the model
 * for the missing ones. Never logs text.
 */
export class RephraseService {
  constructor(
    private readonly provider: Provider,
    private readonly logger: Logger,
    private readonly cache: RephraseCache,
  ) {}

  async rephrase(input: RephraseInput, run: RephraseRun): Promise<Result<number, AppError>> {
    const startedAt = performance.now();
    const passage = selectPassage(input.text, input.caret);
    if (!passage) return this.fail(appError("rephrase_no_sentence"));
    this.logger.info({ event: "rephrase.requested", len: passage.end - passage.start });

    const hash = hashPassage(passage.sentences.map((s) => s.text));
    let sent = 0;
    let lastError = appError("rephrase_no_valid_version");
    for (const tone of selectTones(input.tones)) {
      if (run.signal?.aborted) break;
      const reply = await this.cachedTone(passage, hash, tone, run.signal);
      if (run.signal?.aborted) break;
      if (!reply.ok) {
        lastError = reply.error;
        continue;
      }
      const { language, segments } = reply.value;
      run.onTone({ ...located(passage), tone, language, segments: [...segments] });
      sent++;
    }
    if (run.signal?.aborted) return this.fail(appError("rephrase_cancelled"));
    if (sent === 0) return this.fail(lastError);
    this.logger.info({ event: "rephrase.done", ms: performance.now() - startedAt, len: sent });
    return ok(sent);
  }

  /** The tone from the cache, else from the model (and then cached). */
  private async cachedTone(
    passage: Passage,
    hash: string,
    tone: RephraseTone,
    signal: AbortSignal | undefined,
  ): Promise<Result<ToneReply, AppError>> {
    // One model for the tone (retry included) and its cache key, even if settings change.
    const provider = pinProvider(this.provider);
    const model = provider.model;
    const cached = this.cache.get(model, hash, tone);
    if (cached) {
      this.logger.info({ event: "rephrase.tone_cached", len: cached.segments.length });
      return ok(cached);
    }
    const reply = await this.tone(provider, passage, tone, signal);
    if (reply.ok && !signal?.aborted) this.cache.set(model, hash, tone, reply.value);
    return reply;
  }

  /** One tone: a model call (one retry on invalid JSON), then validation against the split. */
  private async tone(
    provider: Provider,
    passage: Passage,
    tone: RephraseTone,
    signal: AbortSignal | undefined,
  ): Promise<Result<ToneReply, AppError>> {
    const { result: reply, ms } = await timedModelCall({
      feature: "rephrase",
      provider,
      messages: buildRephrasePrompt(
        passage.sentences.map((s) => s.text),
        tone,
      ),
      parse: parseRephraseResponse,
      retryMessage: REPHRASE_RETRY_MESSAGE,
      logger: this.logger,
      signal,
    });
    if (!reply.ok) {
      this.logger.error({ event: "rephrase.tone_failed", ms, code: reply.error.code });
      return reply;
    }
    const segments = validateSegments(reply.value.segments, passage.sentences);
    if (!segments) {
      this.logger.info({ event: "rephrase.version_dropped", len: 1 });
      return err(appError("rephrase_no_valid_version"));
    }
    this.logger.info({ event: "rephrase.tone_done", ms, len: segments.length });
    return ok({ language: reply.value.language, segments });
  }

  private fail(error: AppError): Result<never, AppError> {
    this.logger.error({ event: "rephrase.failed", code: error.code });
    return err(error);
  }
}

const located = (passage: Passage): Pick<RephraseToneResult, "passage" | "sentences"> => ({
  passage: { start: passage.start, end: passage.end },
  sentences: passage.sentences.map(({ text, start, end }) => ({ text, start, end })),
});
