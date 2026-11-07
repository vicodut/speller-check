import { runCheck } from "./cli/check.command";
import { EXIT_USAGE, type ExitCode } from "./cli/exit-code";
import { runServe } from "./cli/serve.command";
import { runSettings } from "./cli/settings.command";
import { runToken } from "./cli/token.command";
import { Logger } from "./shared/logger";

const USAGE = `Usage:
  core check < text   print issues for stdin as JSON
  core serve          run the server on 127.0.0.1 (WebSocket + settings page) until SIGINT/SIGTERM
  core settings       open the settings page of the running core in the browser
  core token          print the install token (created on first use)
  core token --rotate replace the install token and print the new one; a running core
                      refuses the old one at once (paste the new one in the extension options,
                      and run core settings again for the page)

check and serve require GC_BASE_URL and GC_MODEL
  (GC_API_KEY, GC_DICTIONARY_PATH, GC_REASONING_EFFORT optional).
serve, settings and token read GC_PORT (default 7341) and GC_TOKEN_PATH (optional).
Logs go to stderr.
`;

/** A command gets the logger and the arguments after its name. */
const commands: Record<string, (logger: Logger, args: readonly string[]) => Promise<ExitCode>> = {
  check: runCheck,
  serve: runServe,
  settings: runSettings,
  token: runToken,
};

const run = async (args: readonly string[]): Promise<ExitCode> => {
  const command = args[0] === undefined ? undefined : commands[args[0]];
  if (!command) {
    process.stderr.write(USAGE);
    return EXIT_USAGE;
  }
  const code = await command(new Logger(), args.slice(1));
  if (code === EXIT_USAGE) process.stderr.write(USAGE);
  return code;
};

process.exitCode = await run(Bun.argv.slice(2));
