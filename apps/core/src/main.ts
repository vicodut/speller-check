import { CheckCache, CheckService, FieldSessions } from "./features/check";
import { JsonDictionaryRepository } from "./features/dictionary";
import {
  OpenAiCompatibleProvider,
  SwitchableProvider,
  TimeoutRetryProvider,
} from "./features/providers";
import { RephraseCache, RephraseJobs, RephraseService } from "./features/rephrase";
import type { ModelConfig, SettingsService } from "./features/settings";
import { SettingsPageFiles, WebSocketServer } from "./features/transport";
import type { Logger } from "./shared/logger";

export type Core = {
  /** Each feature's provider; swapping one applies to its next call (settings changes). */
  readonly providers: { readonly check: SwitchableProvider; readonly rephrase: SwitchableProvider };
  readonly checkService: CheckService;
  readonly dictionary: JsonDictionaryRepository;
  readonly rephraseService: RephraseService;
  /**
   * Uses another model from the next call on: both providers are swapped, the sentence cache is
   * cleared and the new model is warmed up. Calls in flight finish on the old model.
   */
  readonly switchModel: (model: ModelConfig) => void;
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

/**
 * One feature's provider stack for a model. "OpenAI-compatible" is the HTTP format
 * (/v1/chat/completions), not the OpenAI cloud: local servers (Ollama, LM Studio, llama.cpp)
 * speak it too, so this one adapter covers every model.
 */
const providerFor = (model: ModelConfig, logger: Logger, timeoutMs?: number) =>
  new TimeoutRetryProvider(
    new OpenAiCompatibleProvider(
      {
        baseUrl: model.baseUrl,
        model: model.model,
        apiKey: model.apiKey,
        reasoningEffort: model.reasoningEffort,
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
      },
      logger,
    ),
    RETRY_TIMEOUT_MS,
    logger,
  );

/** Composition root: the only place that wires concrete classes together. */
export const createCore = (
  files: { readonly dictionaryPath: string },
  model: ModelConfig,
  logger: Logger,
): Core => {
  const check = new SwitchableProvider(providerFor(model, logger));
  const cache = new CheckCache();
  const dictionary = new JsonDictionaryRepository(files.dictionaryPath);
  const checkService = new CheckService(check, cache, dictionary, logger);
  // Same endpoint and model as the check, so text goes nowhere new; a tone's reply is longer
  // than a check's, hence its own timeout.
  const rephrase = new SwitchableProvider(providerFor(model, logger, REPHRASE_TIMEOUT_MS));
  const rephraseService = new RephraseService(rephrase, logger, new RephraseCache());
  const warmUp = () => check.warmUp();
  const switchModel = (next: ModelConfig) => {
    check.swap(providerFor(next, logger));
    rephrase.swap(providerFor(next, logger, REPHRASE_TIMEOUT_MS));
    // Keyed by model already; cleared so a switch back re-checks with fresh eyes too.
    cache.clear();
    void warmUp();
  };
  return {
    providers: { check, rephrase },
    checkService,
    dictionary,
    rephraseService,
    switchModel,
    warmUp,
  };
};

export const createServer = (
  core: Core,
  options: {
    readonly port: number;
    readonly token: string;
    readonly settings: SettingsService;
    /** Folder of the built settings page (`apps/settings-web/dist`). */
    readonly settingsPageDir: string;
  },
  logger: Logger,
): WebSocketServer =>
  new WebSocketServer(
    { port: options.port, token: options.token },
    {
      settingsView: () => options.settings.view(),
      profiles: options.settings,
      settingsPage: new SettingsPageFiles(options.settingsPageDir),
      createSession: (publish) => new FieldSessions(core.checkService, publish, logger),
      addDictionaryTerm: (term) => core.dictionary.add(term),
      createRephraser: (publish) => new RephraseJobs(core.rephraseService, publish),
    },
    logger,
  );
