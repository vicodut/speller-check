import { homedir } from "node:os";
import { join } from "node:path";
import { OllamaClient, OllamaProcessLauncher, OllamaRuntime } from "../features/runtime";
import {
  isLocalUrl,
  loadServeSettings,
  type ModelConfig,
  SecurityKeychain,
  SettingsFileRepository,
  SettingsService,
  settingSources,
} from "../features/settings";
import { InstallTokenRepository, type WebSocketServer } from "../features/transport";
import { type Core, createCore, createServer } from "../main";
import type { Logger } from "../shared/logger";
import { EXIT_FAILURE, EXIT_USAGE, type ExitCode } from "./exit-code";

/** The built settings page in this repo; packaging (milestone 6) will point elsewhere. */
const SETTINGS_PAGE_DIR = join(import.meta.dir, "..", "..", "..", "settings-web", "dist");

/**
 * A model change: start Ollama if the new model is on it (or stop the one this app started),
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
  return async (model: ModelConfig) => {
    const mine = ++latest;
    await runtime.use(model);
    if (mine !== latest) return;
    core.switchModel(model);
    server.broadcast({
      type: "settings.changed",
      model: model.model,
      local: isLocalUrl(model.baseUrl),
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
  const token = await new InstallTokenRepository(settings.value.tokenPath).loadOrCreate();
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
  const model = await service.value.current();
  const core = createCore(settings.value, model, logger);
  const runtime = new OllamaRuntime(new OllamaClient(), new OllamaProcessLauncher(), logger);
  const server = createServer(
    core,
    {
      port: settings.value.port,
      token: token.value,
      settings: service.value,
      runtime,
      settingsPageDir: SETTINGS_PAGE_DIR,
    },
    logger,
  );
  if (!server.start().ok) return EXIT_FAILURE;
  service.value.onChange(onModelChange(core, server, runtime, logger));
  // Not awaited: clients can connect while Ollama starts and the model loads; their first check
  // then finds it loaded, or waits for it and retries once after a timeout.
  void runtime.use(model).then(() => core.warmUp());
  await untilSignal();
  server.stop();
  runtime.stop();
  return 0;
};
