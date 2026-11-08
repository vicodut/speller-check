import type { Feature } from "@gc/protocol";
import { CheckCache, CheckService, FieldSessions } from "./features/check";
import { JsonDictionaryRepository } from "./features/dictionary";
import {
  OpenAiCompatibleProvider,
  ProfileProbeProvider,
  SwitchableProvider,
  TimeoutRetryProvider,
} from "./features/providers";
import { RephraseCache, RephraseJobs, RephraseService } from "./features/rephrase";
import { type ModelConfig, type SettingsService, toFeatureModel } from "./features/settings";
import {
  type LocalModelsPort,
  type RuntimePort,
  SettingsPageFiles,
  type TokenSource,
  WebSocketServer,
} from "./features/transport";
import type { AppError } from "./shared/errors";
import type { Logger } from "./shared/logger";
import type { Result } from "./shared/result";

export type Core = {
  /** Each feature's provider; swapping one applies to its next call (settings changes). */
  readonly providers: { readonly check: SwitchableProvider; readonly rephrase: SwitchableProvider };
  readonly checkService: CheckService;
  readonly dictionary: JsonDictionaryRepository;
  readonly rephraseService: RephraseService;
  /**
   * Gives one feature another model from its next call on: only that provider is swapped (and,
   * for Check, the sentence cache cleared), then the model is warmed up. Calls in flight finish
   * on the old model.
   */
  readonly switchModel: (feature: Feature, model: ModelConfig) => void;
  /** Loads each feature's model in the background so the first call doesn't wait for it. */
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
  models: Readonly<Record<Feature, ModelConfig>>,
  logger: Logger,
): Core => {
  const check = new SwitchableProvider(providerFor(models.check, logger));
  const cache = new CheckCache();
  const dictionary = new JsonDictionaryRepository(files.dictionaryPath);
  const checkService = new CheckService(check, cache, dictionary, logger);
  // A tone's reply is longer than a check's, hence its own timeout.
  const rephrase = new SwitchableProvider(
    providerFor(models.rephrase, logger, REPHRASE_TIMEOUT_MS),
  );
  const rephraseService = new RephraseService(rephrase, logger, new RephraseCache());
  // At launch, one warm-up per distinct model: the same model loads once for both features.
  const sameModel = JSON.stringify(models.check) === JSON.stringify(models.rephrase);
  const warmUp = async () => {
    await Promise.all(sameModel ? [check.warmUp()] : [check.warmUp(), rephrase.warmUp()]);
  };
  const switchModel = (feature: Feature, next: ModelConfig) => {
    if (feature === "check") {
      check.swap(providerFor(next, logger));
      // Keyed by model already; cleared so a switch back re-checks with fresh eyes too.
      cache.clear();
      void check.warmUp();
      return;
    }
    rephrase.swap(providerFor(next, logger, REPHRASE_TIMEOUT_MS));
    void rephrase.warmUp();
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

/**
 * The WebSocket server and settings page. `token` is read on every hello and API call;
 * `rotateToken` writes a new one, after which every connected client must hello again.
 */
export const createServer = (
  core: Core,
  options: {
    readonly port: number;
    readonly token: TokenSource;
    readonly rotateToken: () => Promise<Result<string, AppError>>;
    readonly settings: SettingsService;
    readonly runtime: RuntimePort;
    readonly localModels: LocalModelsPort;
    /** Folder of the built settings page (`apps/settings-web/dist`). */
    readonly settingsPageDir: string;
  },
  logger: Logger,
): WebSocketServer => {
  const rotate = async () => {
    const rotated = await options.rotateToken();
    if (rotated.ok) server.revokeAll();
    return rotated;
  };
  const server = new WebSocketServer(
    { port: options.port, token: options.token },
    {
      settingsView: () => options.settings.view(),
      profiles: options.settings,
      probe: new ProfileProbeProvider(
        (profileId, baseUrl) => options.settings.savedKeyFor(profileId, baseUrl),
        logger,
      ),
      runtime: options.runtime,
      localModels: options.localModels,
      tokens: { rotate },
      settingsPage: new SettingsPageFiles(options.settingsPageDir),
      createSession: (publish) => new FieldSessions(core.checkService, publish, logger),
      currentModels: async () => {
        const models = await options.settings.current();
        return { check: toFeatureModel(models.check), rephrase: toFeatureModel(models.rephrase) };
      },
      addDictionaryTerm: (term) => core.dictionary.add(term),
      createRephraser: (publish) => new RephraseJobs(core.rephraseService, publish),
    },
    logger,
  );
  return server;
};
