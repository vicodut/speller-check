import type { RephraseToneResult } from "@gc/protocol";
import type { AppError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import type { ChatMessage, CompleteOptions, Provider } from "../providers";
import { RephraseService } from "./rephrase.service";
import { RephraseCache } from "./services/rephrase-cache.service";

export type Reply = string | AppError;

/** Replies with each scripted reply in turn (the last one repeats) and records the prompts. */
export const fakeProvider = (
  replies: Reply[],
  onCall?: (call: number) => void,
  model = "test-model",
) => {
  const prompts: string[] = [];
  let call = 0;
  const provider: Provider = {
    model,
    healthcheck: async () => true,
    complete: async (
      messages: readonly ChatMessage[],
      _options?: CompleteOptions,
    ): Promise<Result<string, AppError>> => {
      prompts.push(messages.map((m) => m.content).join("\n"));
      onCall?.(call);
      const reply = replies[Math.min(call++, replies.length - 1)] ?? "";
      return typeof reply === "string" ? ok(reply) : err(reply);
    },
  };
  return { provider, prompts };
};

export const keepAll = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ sentences: [i + 1], keep: true }));
export const reply = (segments: unknown[], language = "en") =>
  JSON.stringify({ language, segments });

export type Options = { onCall?: (call: number) => void; cache?: RephraseCache; model?: string };

export const setup = (replies: Reply[], options: Options = {}) => {
  const { provider, prompts } = fakeProvider(replies, options.onCall, options.model);
  const logs: string[] = [];
  const logger = new Logger((line) => logs.push(line));
  const service = new RephraseService(provider, logger, options.cache ?? new RephraseCache());
  const tones: RephraseToneResult[] = [];
  const run = (text: string, caret: number, signal?: AbortSignal) =>
    service.rephrase({ text, caret }, { signal, onTone: (t) => tones.push(t) });
  return { run, prompts, logs, tones };
};

export const TEXT = "Intro line.\n\nThe meeting moved to Monday. Bring the 3 reports. Thanks.";
export const caret = TEXT.indexOf("Bring");
