import type { SettingsView } from "@gc/protocol";
import { CheckCache, CheckService, FieldSessions } from "./features/check";
import { JsonDictionaryRepository } from "./features/dictionary";
import { OpenAiCompatibleProvider, TimeoutRetryProvider } from "./features/providers";
import { RephraseCache, RephraseJobs, RephraseService } from "./features/rephrase";
import type { Settings } from "./features/settings";
import { SettingsPageFiles, WebSocketServer } from "./features/transport";
import type { Logger } from "./shared/logger";

export type Core = {
  readonly checkService: CheckService;
  readonly dictionary: JsonDictionaryRepository;
  readonly rephraseService: RephraseService;
  /** Loads the model in the background so the first check doesn't wait for it. */
  readonly warmUp: () => Promise<void>;
};

/** Per tone call: qwen3:8b on a CPU-only Mac takes ~10 s warm for one tone (2026-11-02). */
const REPHRASE_TIMEOUT_MS = 60_000;

/**
 * A call that times out is retried once with this timeout: a cold or idle-unloaded local model
 * (qwen3:8b on CPU) takes ~70 s to load before it answers (2026-11-05, #23).
 */
const RETRY_TIMEOUT_MS = 150_000;

/** Composition root: the only place that wires concrete classes together. */
export const createCore = (settings: Settings, logger: Logger): Core => {
  const config = {
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKey: settings.apiKey,
    reasoningEffort: settings.reasoningEffort,
  };
  // "OpenAI-compatible" is the HTTP format (/v1/chat/completions), not the OpenAI cloud: local
  // servers (Ollama, LM Studio, llama.cpp) speak it too, so this one adapter covers every model.
  const base = new OpenAiCompatibleProvider(config, logger);
  const provider = new TimeoutRetryProvider(base, RETRY_TIMEOUT_MS, logger);
  const dictionary = new JsonDictionaryRepository(settings.dictionaryPath);
  const checkService = new CheckService(provider, new CheckCache(), dictionary, logger);
  // Same endpoint and model as the check, so text goes nowhere new; a tone's reply is longer
  // than a check's, hence its own timeout.
  const rephraseProvider = new TimeoutRetryProvider(
    new OpenAiCompatibleProvider({ ...config, timeoutMs: REPHRASE_TIMEOUT_MS }, logger),
    RETRY_TIMEOUT_MS,
    logger,
  );
  const rephraseService = new RephraseService(rephraseProvider, logger, new RephraseCache());
  return { checkService, dictionary, rephraseService, warmUp: () => base.warmUp() };
};

export const createServer = (
  core: Core,
  options: {
    readonly port: number;
    readonly token: string;
    readonly view: SettingsView;
    /** Folder of the built settings page (`apps/settings-web/dist`). */
    readonly settingsPageDir: string;
  },
  logger: Logger,
): WebSocketServer =>
  new WebSocketServer(
    { port: options.port, token: options.token },
    {
      settingsView: () => options.view,
      settingsPage: new SettingsPageFiles(options.settingsPageDir),
      createSession: (publish) => new FieldSessions(core.checkService, publish, logger),
      addDictionaryTerm: (term) => core.dictionary.add(term),
      createRephraser: (publish) => new RephraseJobs(core.rephraseService, publish),
    },
    logger,
  );
