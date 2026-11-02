import type { ModelRephraseResponse, RephraseResult } from "@gc/protocol";
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
import { validateVersions } from "./services/version-validator.service";

/** The field text and the caret offset in it. */
export type RephraseInput = { readonly text: string; readonly caret: number };

/**
 * Rephrases the passage at the caret in four tones with one model call. Offsets come from the
 * core's own sentence split; the model only answers by sentence number. Never logs text.
 */
export class RephraseService {
  constructor(
    private readonly provider: Provider,
    private readonly logger: Logger,
  ) {}

  async rephrase(input: RephraseInput): Promise<Result<RephraseResult, AppError>> {
    const startedAt = performance.now();
    const passage = selectPassage(input.text, input.caret);
    if (!passage) return this.fail(appError("rephrase_no_sentence"));
    this.logger.info({ event: "rephrase.requested", len: passage.end - passage.start });

    const messages = buildRephrasePrompt(passage.sentences.map((s) => s.text));
    const reply = await this.request(messages);
    if (!reply.ok) return this.fail(reply.error);

    const { versions, dropped } = validateVersions(reply.value.versions, passage.sentences);
    if (dropped > 0) this.logger.info({ event: "rephrase.version_dropped", len: dropped });
    if (versions.length === 0) return this.fail(appError("rephrase_no_valid_version"));

    this.logger.info({
      event: "rephrase.done",
      ms: performance.now() - startedAt,
      len: passage.end - passage.start,
    });
    return ok({ ...toLocated(passage), language: reply.value.language, versions });
  }

  /** Calls the model, retrying once if the reply isn't valid JSON in the expected envelope. */
  private async request(
    messages: readonly ChatMessage[],
  ): Promise<Result<ModelRephraseResponse, AppError>> {
    const first = await this.provider.complete(messages);
    if (!first.ok) return first;
    const parsed = parseRephraseResponse(first.value);
    if (parsed.ok) return parsed;

    this.logger.info({ event: "parse.retry", code: parsed.error.code });
    const second = await this.provider.complete([...messages, REPHRASE_RETRY_MESSAGE]);
    return second.ok ? parseRephraseResponse(second.value) : second;
  }

  private fail(error: AppError): Result<never, AppError> {
    this.logger.error({ event: "rephrase.failed", code: error.code });
    return err(error);
  }
}

const toLocated = (passage: Passage): Pick<RephraseResult, "passage" | "sentences"> => ({
  passage: { start: passage.start, end: passage.end },
  sentences: passage.sentences.map(({ text, start, end }) => ({ text, start, end })),
});
