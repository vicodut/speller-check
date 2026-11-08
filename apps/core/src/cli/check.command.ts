import { homedir } from "node:os";
import { loadSettings } from "../features/settings";
import { createCore } from "../main";
import type { Logger } from "../shared/logger";
import { EXIT_FAILURE, EXIT_USAGE, type ExitCode } from "./exit-code";

/** `core check`: reads text on stdin, prints located issues as JSON on stdout. */
export const runCheck = async (logger: Logger): Promise<ExitCode> => {
  const settings = loadSettings(process.env, homedir());
  if (!settings.ok) {
    logger.error({ event: "cli.failed", code: settings.error.code });
    return EXIT_USAGE;
  }
  const text = await Bun.stdin.text();
  const result = await createCore(
    settings.value,
    { check: settings.value, rephrase: settings.value },
    logger,
  ).checkService.check({
    text,
  });
  if (!result.ok) {
    logger.error({ event: "cli.failed", code: result.error.code });
    return EXIT_FAILURE;
  }
  process.stdout.write(`${JSON.stringify(result.value.issues, null, 2)}\n`);
  return 0;
};
