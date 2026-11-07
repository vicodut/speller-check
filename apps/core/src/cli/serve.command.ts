import { homedir } from "node:os";
import { join } from "node:path";
import { buildSettingsView, loadSettings, settingSources } from "../features/settings";
import { InstallTokenRepository } from "../features/transport";
import { createCore, createServer } from "../main";
import type { Logger } from "../shared/logger";
import { EXIT_FAILURE, EXIT_USAGE, type ExitCode } from "./exit-code";

/** The built settings page in this repo; packaging (milestone 6) will point elsewhere. */
const SETTINGS_PAGE_DIR = join(import.meta.dir, "..", "..", "..", "settings-web", "dist");

const untilSignal = (): Promise<void> =>
  new Promise((resolve) => {
    process.once("SIGINT", () => resolve());
    process.once("SIGTERM", () => resolve());
  });

/** `core serve`: runs the WebSocket server on 127.0.0.1 until SIGINT or SIGTERM. */
export const runServe = async (logger: Logger): Promise<ExitCode> => {
  const settings = loadSettings(process.env, homedir());
  if (!settings.ok) {
    logger.error({ event: "cli.failed", code: settings.error.code });
    return EXIT_USAGE;
  }
  const token = await new InstallTokenRepository(settings.value.tokenPath).loadOrCreate();
  if (!token.ok) {
    logger.error({ event: "cli.failed", code: token.error.code });
    return EXIT_FAILURE;
  }
  const view = buildSettingsView(process.env, settings.value);
  logger.info({ event: "settings.loaded", sources: settingSources(view.check) });
  const core = createCore(settings.value, logger);
  const server = createServer(
    core,
    { port: settings.value.port, token: token.value, view, settingsPageDir: SETTINGS_PAGE_DIR },
    logger,
  );
  if (!server.start().ok) return EXIT_FAILURE;
  // Not awaited: clients can connect while the model loads; their first check then finds it
  // loaded, or waits for it and retries once after a timeout.
  void core.warmUp();
  await untilSignal();
  server.stop();
  return 0;
};
