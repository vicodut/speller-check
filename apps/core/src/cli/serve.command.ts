import { homedir, totalmem } from "node:os";
import type { Feature, FeatureModel } from "@gc/protocol";
import {
  CURATED_MANIFEST,
  LocalModels,
  ModelDownloader,
  ModelFiles,
} from "../features/local-models";
import { OllamaClient, OllamaProcessLauncher, OllamaRuntime } from "../features/runtime";
import {
  defaultModelsDir,
  type FeatureModels,
  loadServeSettings,
  type ModelConfig,
  SecurityKeychain,
  SettingsFileRepository,
  SettingsService,
  settingSources,
  toFeatureModel,
} from "../features/settings";
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
  const settings = loadServeSettings(process.env, homedir());
  if (!settings.ok) {
    logger.error({ event: "cli.failed", code: settings.error.code });
    return EXIT_USAGE;
  }
  const tokenPath = settings.value.tokenPath;
  const tokens = new InstallTokenRepository(tokenPath);
  const token = await tokens.loadOrCreate();
  if (!token.ok) {
    logger.error({ event: "cli.failed", code: token.error.code });
    return EXIT_FAILURE;
  }
  const service = await SettingsService.open(
    new SettingsFileRepository(settings.value.settingsPath),
    new SecurityKeychain(),
    process.env,
    settings.value.envModel,
  );
  if (!service.ok) {
    logger.error({ event: "cli.failed", code: service.error.code });
    return EXIT_FAILURE;
  }
  logger.info({ event: "settings.loaded", sources: settingSources(service.value.view().check) });
  const models = await service.value.current();
  const core = createCore(settings.value, models, logger);
  const watcher = new InstallTokenWatcher(tokenPath, token.value);
  const runtime = new OllamaRuntime(new OllamaClient(), new OllamaProcessLauncher(), logger);
  const modelFiles = new ModelFiles(defaultModelsDir(homedir()));
  const localModels = new LocalModels({
    manifest: CURATED_MANIFEST,
    files: modelFiles,
    downloader: new ModelDownloader(modelFiles),
    // A profile uses a curated model by naming its manifest id as its model.
    inUse: (id) => service.value.profiles().profiles.some((p) => p.model === id),
    memoryBytes: totalmem(),
    logger,
  });
  const server = createServer(
    core,
    {
      port: settings.value.port,
      // Re-read when the file changes, so `core token --rotate` applies without a restart.
      token: () => watcher.current(),
      rotateToken: () => tokens.rotate(),
      settings: service.value,
      runtime,
      localModels,
      settingsPageDir: SETTINGS_PAGE_DIR,
    },
    logger,
  );
  if (!server.start().ok) return EXIT_FAILURE;
  service.value.onChange(onModelChange(core, server, runtime, logger));
  // Not awaited: clients can connect while Ollama starts and the model loads; their first check
  // then finds it loaded, or waits for it and retries once after a timeout.
  void runtime.use(models.check, models.rephrase).then(() => core.warmUp());
  await untilSignal();
  localModels.cancel();
  server.stop();
  runtime.stop();
  return 0;
};
