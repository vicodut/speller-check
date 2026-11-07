import { homedir } from "node:os";
import { loadTransportSettings } from "../features/settings";
import { InstallTokenRepository } from "../features/transport";
import type { Logger } from "../shared/logger";
import { EXIT_FAILURE, EXIT_USAGE, type ExitCode } from "./exit-code";
import { settingsUrl } from "./settings-url.util";

/**
 * `core settings`: opens the settings page of a running core in the default browser (macOS
 * `open`). If the browser can't be opened, prints the link instead.
 */
export const runSettings = async (logger: Logger): Promise<ExitCode> => {
  const settings = loadTransportSettings(process.env, homedir());
  if (!settings.ok) {
    logger.error({ event: "cli.failed", code: settings.error.code });
    return EXIT_USAGE;
  }
  const token = await new InstallTokenRepository(settings.value.tokenPath).loadOrCreate();
  if (!token.ok) {
    logger.error({ event: "cli.failed", code: token.error.code });
    return EXIT_FAILURE;
  }
  const url = settingsUrl(settings.value.port, token.value);
  const opened = await Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" }).exited;
  if (opened !== 0) process.stdout.write(`${url}\n`);
  return 0;
};
