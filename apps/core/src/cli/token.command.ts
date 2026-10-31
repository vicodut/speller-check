import { homedir } from "node:os";
import { loadTransportSettings } from "../features/settings";
import { InstallTokenRepository } from "../features/transport";
import type { Logger } from "../shared/logger";
import { EXIT_FAILURE, EXIT_USAGE, type ExitCode } from "./exit-code";

/** `core token`: prints the install token on stdout, creating it on first use. */
export const runToken = async (logger: Logger): Promise<ExitCode> => {
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
  process.stdout.write(`${token.value}\n`);
  return 0;
};
