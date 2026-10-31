import { runCheck } from "./cli/check.command";
import { EXIT_USAGE, type ExitCode } from "./cli/exit-code";
import { runServe } from "./cli/serve.command";
import { runToken } from "./cli/token.command";
import { Logger } from "./shared/logger";

const USAGE = `Usage:
  core check < text   print issues for stdin as JSON
  core serve          run the WebSocket server on 127.0.0.1 until SIGINT/SIGTERM
  core token          print the install token (created on first use)

check and serve require GC_BASE_URL and GC_MODEL
  (GC_API_KEY, GC_DICTIONARY_PATH, GC_REASONING_EFFORT optional).
serve and token read GC_PORT (default 7341) and GC_TOKEN_PATH (optional).
Logs go to stderr.
`;

const commands: Record<string, (logger: Logger) => Promise<ExitCode>> = {
  check: runCheck,
  serve: runServe,
  token: runToken,
};

const run = async (args: readonly string[]): Promise<ExitCode> => {
  const command = args[0] === undefined ? undefined : commands[args[0]];
  if (!command) {
    process.stderr.write(USAGE);
    return EXIT_USAGE;
  }
  const code = await command(new Logger());
  if (code === EXIT_USAGE) process.stderr.write(USAGE);
  return code;
};

process.exitCode = await run(Bun.argv.slice(2));
