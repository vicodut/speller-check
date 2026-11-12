import { homedir } from "node:os";
import { loadTransportSettings } from "../features/settings";
import { InstallTokenRepository } from "../features/transport";
import type { Logger } from "../shared/logger";
import { EXIT_FAILURE, EXIT_USAGE, type ExitCode } from "./exit-code";

/** What `core token` should do with its arguments; null means they aren't understood. */
export const tokenAction = (args: readonly string[]): "print" | "rotate" | null => {
  if (args.length === 0) return "print";
  if (args.length === 1 && args[0] === "--rotate") return "rotate";
  return null;
};

/**
 * `core token`: prints the install token on stdout, creating it on first use.
 * `core token --rotate`: replaces it with a new one and prints that; a running core refuses the
 * old token from its next handshake or API call.
 */
export const runToken = async (logger: Logger, args: readonly string[] = []): Promise<ExitCode> => {
  const action = tokenAction(args);
  if (!action) return EXIT_USAGE;
  const settings = loadTransportSettings(process.env, homedir());
  if (!settings.ok) {
    logger.error({ event: "cli.failed", code: settings.error.code });
    return EXIT_USAGE;
  }
  const repository = new InstallTokenRepository(settings.value.tokenPath);
  const token = action === "rotate" ? await repository.rotate() : await repository.loadOrCreate();
  if (!token.ok) {
    logger.error({ event: "cli.failed", code: token.error.code });
    return EXIT_FAILURE;
  }
  process.stdout.write(`${token.value}\n`);
  return 0;
};
