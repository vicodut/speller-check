import { homedir } from "node:os";
import { join } from "node:path";
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

/** A model change: swap the providers, then tell every client which model is in use now. */
const onModelChange =
  (core: Core, server: WebSocketServer, logger: Logger) => (model: ModelConfig) => {
    core.switchModel(model);
    server.broadcast({
      type: "settings.changed",
      model: model.model,
      local: isLocalUrl(model.baseUrl),
    });
    logger.info({ event: "settings.switched" });
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
  const core = createCore(settings.value, await service.value.current(), logger);
  const server = createServer(
    core,
    {
      port: settings.value.port,
      token: token.value,
      settings: service.value,
      settingsPageDir: SETTINGS_PAGE_DIR,
    },
    logger,
  );
  if (!server.start().ok) return EXIT_FAILURE;
  service.value.onChange(onModelChange(core, server, logger));
  // Not awaited: clients can connect while the model loads; their first check then finds it
  // loaded, or waits for it and retries once after a timeout.
  void core.warmUp();
  await untilSignal();
  server.stop();
  return 0;
};
