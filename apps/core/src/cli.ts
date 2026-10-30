import { homedir } from "node:os";
import { loadSettings } from "./features/settings";
import { createCore } from "./main";
import { Logger } from "./shared/logger";

const USAGE =
  "Usage: core check < text\nRequires GC_BASE_URL and GC_MODEL (GC_API_KEY, GC_DICTIONARY_PATH optional).\n";

/** `core check`: reads text on stdin, prints located issues as JSON on stdout. Logs go to stderr. */
const run = async (args: readonly string[]): Promise<number> => {
  const logger = new Logger();
  if (args[0] !== "check") {
    process.stderr.write(USAGE);
    return 2;
  }
  const settings = loadSettings(process.env, homedir());
  if (!settings.ok) {
    logger.error({ event: "cli.failed", code: settings.error.code });
    process.stderr.write(USAGE);
    return 2;
  }
  const text = await Bun.stdin.text();
  const result = await createCore(settings.value, logger).checkService.check({ text });
  if (!result.ok) {
    logger.error({ event: "cli.failed", code: result.error.code });
    return 1;
  }
  process.stdout.write(`${JSON.stringify(result.value.issues, null, 2)}\n`);
  return 0;
};

process.exitCode = await run(Bun.argv.slice(2));
