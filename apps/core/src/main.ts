import { CheckCache, CheckService, FieldSessions } from "./features/check";
import { JsonDictionaryRepository } from "./features/dictionary";
import { OpenAiCompatibleProvider } from "./features/providers";
import type { Settings } from "./features/settings";
import { WebSocketServer } from "./features/transport";
import type { Logger } from "./shared/logger";

export type Core = {
  readonly checkService: CheckService;
  readonly dictionary: JsonDictionaryRepository;
};

/** Composition root: the only place that wires concrete classes together. */
export const createCore = (settings: Settings, logger: Logger): Core => {
  const provider = new OpenAiCompatibleProvider(
    {
      baseUrl: settings.baseUrl,
      model: settings.model,
      apiKey: settings.apiKey,
      reasoningEffort: settings.reasoningEffort,
    },
    logger,
  );
  const dictionary = new JsonDictionaryRepository(settings.dictionaryPath);
  const checkService = new CheckService(provider, new CheckCache(), dictionary, logger);
  return { checkService, dictionary };
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
    },
    logger,
  );
