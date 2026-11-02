import {
  type ModelRephraseResponse,
  type RephraseSegment,
  RephraseTone,
  type RephraseToneResult,
} from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import type { ChatMessage, Provider } from "../providers";
import { type Passage, selectPassage } from "./services/passage-selector.service";
import {
  buildRephrasePrompt,
  REPHRASE_RETRY_MESSAGE,
} from "./services/rephrase-prompt-builder.service";
import { parseRephraseResponse } from "./services/rephrase-response-parser.service";
import { validateSegments } from "./services/segment-validator.service";

/** The field text and the caret offset in it. */
export type RephraseInput = { readonly text: string; readonly caret: number };

/** Receives each validated tone as soon as it is ready; `signal` stops the remaining calls. */
export type RephraseRun = {
  readonly signal?: AbortSignal | undefined;
  onTone(tone: RephraseToneResult): void;
};

type ToneReply = {
  readonly language: ModelRephraseResponse["language"];
  segments: RephraseSegment[];
};

/**
 * Rephrases the passage at the caret with one short model call per tone, in display order.
 * A failed or invalid tone is skipped. Resolves to the number of tones sent. Offsets come from
 * the core's own sentence split; the model only answers by sentence number. Never logs text.
 */
export class RephraseService {
  constructor(
    private readonly provider: Provider,
    private readonly logger: Logger,
  ) {}

  async rephrase(input: RephraseInput, run: RephraseRun): Promise<Result<number, AppError>> {
    const startedAt = performance.now();
    const passage = selectPassage(input.text, input.caret);
    if (!passage) return this.fail(appError("rephrase_no_sentence"));
    this.logger.info({ event: "rephrase.requested", len: passage.end - passage.start });

    let sent = 0;
    let lastError = appError("rephrase_no_valid_version");
    for (const tone of RephraseTone.options) {
      if (run.signal?.aborted) break;
      const reply = await this.tone(passage, tone, run.signal);
      if (run.signal?.aborted) break;
      if (!reply.ok) {
        lastError = reply.error;
        continue;
      }
      run.onTone({ ...located(passage), tone, ...reply.value });
      sent++;
    }
    if (run.signal?.aborted) return this.fail(appError("rephrase_cancelled"));
    if (sent === 0) return this.fail(lastError);
    this.logger.info({ event: "rephrase.done", ms: performance.now() - startedAt, len: sent });
    return ok(sent);
  }

  /** One tone: a model call (one retry on invalid JSON), then validation against the split. */
  private async tone(
    passage: Passage,
    tone: RephraseTone,
    signal: AbortSignal | undefined,
  ): Promise<Result<ToneReply, AppError>> {
    const startedAt = performance.now();
    const messages = buildRephrasePrompt(
      passage.sentences.map((s) => s.text),
      tone,
    );
    const reply = await this.request(messages, signal);
    const ms = performance.now() - startedAt;
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

  /** Calls the model, retrying once if the reply isn't valid JSON in the expected envelope. */
  private async request(
    messages: readonly ChatMessage[],
    signal: AbortSignal | undefined,
  ): Promise<Result<ModelRephraseResponse, AppError>> {
    const first = await this.provider.complete(messages, { signal });
    if (!first.ok) return first;
    const parsed = parseRephraseResponse(first.value);
    if (parsed.ok || signal?.aborted) return parsed;

    this.logger.info({ event: "parse.retry", code: parsed.error.code });
    const second = await this.provider.complete([...messages, REPHRASE_RETRY_MESSAGE], { signal });
    return second.ok ? parseRephraseResponse(second.value) : second;
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
