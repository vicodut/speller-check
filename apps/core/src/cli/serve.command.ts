import { homedir, totalmem } from "node:os";
import { dirname, join } from "node:path";
import type { Feature } from "@gc/protocol";
import {
  CURATED_MANIFEST,
  LocalModels,
  ModelDownloader,
  ModelFiles,
} from "../features/local-models";
import { OllamaClient, OllamaProcessLauncher, OllamaRuntime } from "../features/runtime";
import {
  defaultModelsDir,
  ENVIRONMENT_PROFILE_ID,
  type FeatureModels,
  loadServeSettings,
  SecurityKeychain,
  type ServeSettings,
  SettingsFileRepository,
  SettingsService,
  settingSources,
  toFeatureModel,
} from "../features/settings";
import {
  StatisticsFileRepository,
  StatisticsRecorder,
  StatisticsService,
} from "../features/statistics";
import {
  InstallTokenRepository,
  InstallTokenWatcher,
  type WebSocketServer,
} from "../features/transport";
import { type Core, createCore, createServer } from "../main";
import type { Logger } from "../shared/logger";
import { EXIT_FAILURE, EXIT_USAGE, type ExitCode } from "./exit-code";
import { settingsPageDir } from "./settings-page-dir.util";

/** The built settings page: beside a compiled binary, or the repo build when run from source. */
const SETTINGS_PAGE_DIR = settingsPageDir(process.env, process.execPath, import.meta.dir);

/**
 * A model change: start Ollama if a model in use is on it (or stop the one this app started),
 * then swap the providers and tell every client. Starting Ollama can take seconds, so only the
 * latest change is applied: an older one finishing late never wins.
 */
const onModelChange = (
  core: Core,
  server: WebSocketServer,
  runtime: OllamaRuntime,
  logger: Logger,
) => {
  let latest = 0;
  return async (models: FeatureModels, changed: readonly Feature[]) => {
    const mine = ++latest;
    await runtime.use(models.check, models.rephrase);
    if (mine !== latest) return;
    for (const feature of changed) core.switchModel(feature, models[feature]);
    server.broadcast({
      type: "settings.changed",
      check: toFeatureModel(models.check),
      rephrase: toFeatureModel(models.rephrase),
    });
    logger.info({ event: "settings.switched" });
  };
};

/** A profile's current name for the statistics page; the env var model is shown as Environment. */
const profileName = (settings: SettingsService, id: string): string | undefined =>
  id === ENVIRONMENT_PROFILE_ID
    ? "Environment"
    : settings.profiles().profiles.find((p) => p.id === id)?.name;

/**
 * The statistics: the recorder, saved beside the settings file (numbers and codes only) and read
 * in before serving, and the page's view of them. A deleted profile keeps its last name beside
 * its rows, so the statistics can still label them.
 */
const statisticsFor = async (
  settings: SettingsService,
  settingsPath: string,
  logger: Logger,
): Promise<{ recorder: StatisticsRecorder; service: StatisticsService }> => {
  const file = join(dirname(settingsPath), "statistics.json");
  const recorder = new StatisticsRecorder(new StatisticsFileRepository(file), logger);
  await recorder.load();
  settings.onRemoved(({ id, name }) => recorder.markRemoved(id, name));
  const service = new StatisticsService(recorder, (id) => profileName(settings, id));
  return { recorder, service };
};

/** The curated models on disk and their downloads; a profile uses one by naming its manifest id. */
const localModelsFor = (settings: SettingsService, logger: Logger): LocalModels => {
  const modelFiles = new ModelFiles(defaultModelsDir(homedir()));
  return new LocalModels({
    manifest: CURATED_MANIFEST,
    files: modelFiles,
    downloader: new ModelDownloader(modelFiles),
    inUse: (id) => settings.profiles().profiles.some((p) => p.model === id),
    memoryBytes: totalmem(),
    logger,
  });
};

/** What `core serve` opens before it builds anything. */
type Opened = {
  readonly settings: ServeSettings;
  readonly tokens: InstallTokenRepository;
  readonly token: string;
  readonly service: SettingsService;
};

/** Loads the serve settings, the install token and the saved profiles; the exit code when one fails. */
const openServe = async (logger: Logger): Promise<Opened | ExitCode> => {
  const loaded = loadServeSettings(process.env, homedir());
  if (!loaded.ok) {
    logger.error({ event: "cli.failed", code: loaded.error.code });
    return EXIT_USAGE;
  }
  const tokens = new InstallTokenRepository(loaded.value.tokenPath);
  const token = await tokens.loadOrCreate();
  if (!token.ok) {
    logger.error({ event: "cli.failed", code: token.error.code });
    return EXIT_FAILURE;
  }
  const service = await SettingsService.open(
    new SettingsFileRepository(loaded.value.settingsPath),
    new SecurityKeychain(),
    process.env,
    loaded.value.envModel,
  );
  if (!service.ok) {
    logger.error({ event: "cli.failed", code: service.error.code });
    return EXIT_FAILURE;
  }
  logger.info({ event: "settings.loaded", sources: settingSources(service.value.view().check) });
  return { settings: loaded.value, tokens, token: token.value, service: service.value };
};

const untilSignal = (): Promise<void> =>
  new Promise((resolve) => {
    process.once("SIGINT", () => resolve());
    process.once("SIGTERM", () => resolve());
  });

/**
 * `core serve`: runs the WebSocket server and settings page on 127.0.0.1 until SIGINT or SIGTERM.
 * The model comes from the saved profiles, or from `GC_*` env vars when set.
 */
export const runServe = async (logger: Logger): Promise<ExitCode> => {
  const opened = await openServe(logger);
  if (typeof opened === "number") return opened;
  const { settings, tokens, token, service } = opened;
  const models = await service.current();
  const statistics = await statisticsFor(service, settings.settingsPath, logger);
  const core = createCore(settings, models, logger, statistics.recorder);
  const watcher = new InstallTokenWatcher(settings.tokenPath, token);
  const runtime = new OllamaRuntime(new OllamaClient(), new OllamaProcessLauncher(), logger);
  const localModels = localModelsFor(service, logger);
  const server = createServer(
    core,
    {
      port: settings.port,
      // Re-read when the file changes, so `core token --rotate` applies without a restart.
      token: () => watcher.current(),
      rotateToken: () => tokens.rotate(),
      settings: service,
      runtime,
      localModels,
      settingsPageDir: SETTINGS_PAGE_DIR,
      statistics: statistics.service,
    },
    logger,
  );
  if (!server.start().ok) return EXIT_FAILURE;
  service.onChange(onModelChange(core, server, runtime, logger));
  // Not awaited: clients can connect while Ollama starts and the model loads; their first check
  // then finds it loaded, or waits for it and retries once after a timeout.
  void runtime.use(models.check, models.rephrase).then(() => core.warmUp());
  await untilSignal();
  localModels.cancel();
  server.stop();
  runtime.stop();
  return 0;
};
