import { CheckCache, CheckService, FieldSessions } from "./features/check";
import { JsonDictionaryRepository } from "./features/dictionary";
import { OpenAiCompatibleProvider } from "./features/providers";
import { RephraseService } from "./features/rephrase";
import type { Settings } from "./features/settings";
import { WebSocketServer } from "./features/transport";
import type { Logger } from "./shared/logger";

export type Core = {
  readonly checkService: CheckService;
  readonly dictionary: JsonDictionaryRepository;
  readonly rephraseService: RephraseService;
};

/** qwen3:8b takes ~30 s warm for a short paragraph in four tones (2026-11-01). */
const REPHRASE_TIMEOUT_MS = 120_000;

/** Composition root: the only place that wires concrete classes together. */
export const createCore = (settings: Settings, logger: Logger): Core => {
  const config = {
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKey: settings.apiKey,
    reasoningEffort: settings.reasoningEffort,
  };
  const provider = new OpenAiCompatibleProvider(config, logger);
  const dictionary = new JsonDictionaryRepository(settings.dictionaryPath);
  const checkService = new CheckService(provider, new CheckCache(), dictionary, logger);
  // Same endpoint and model as the check, so text goes nowhere new; four tones in one reply
  // take longer than a check, hence its own timeout.
  const rephraseProvider = new OpenAiCompatibleProvider(
    { ...config, timeoutMs: REPHRASE_TIMEOUT_MS },
    logger,
  );
  const rephraseService = new RephraseService(rephraseProvider, logger);
  return { checkService, dictionary, rephraseService };
};

export const createServer = (
  core: Core,
  options: { readonly port: number; readonly token: string },
  logger: Logger,
): WebSocketServer =>
  new WebSocketServer(
    options,
    {
      createSession: (publish) => new FieldSessions(core.checkService, publish, logger),
      addDictionaryTerm: (term) => core.dictionary.add(term),
      rephrase: (input) => core.rephraseService.rephrase(input),
    },
    logger,
  );
