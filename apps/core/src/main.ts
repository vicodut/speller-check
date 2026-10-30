import { CheckCache, CheckService } from "./features/check";
import { JsonDictionaryRepository } from "./features/dictionary";
import { OpenAiCompatibleProvider } from "./features/providers";
import type { Settings } from "./features/settings";
import type { Logger } from "./shared/logger";

export type Core = {
  readonly checkService: CheckService;
};

/** Composition root: the only place that wires concrete classes together. */
export const createCore = (settings: Settings, logger: Logger): Core => {
  const provider = new OpenAiCompatibleProvider(
    { baseUrl: settings.baseUrl, model: settings.model, apiKey: settings.apiKey },
    logger,
  );
  const dictionary = new JsonDictionaryRepository(settings.dictionaryPath);
  return { checkService: new CheckService(provider, new CheckCache(), dictionary, logger) };
};
