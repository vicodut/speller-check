// Dev launcher: builds the settings page, then runs `core serve`. The core starts Ollama itself
// when the model in use is on it, and stops it on a switch to cloud or on quit. Ctrl-C stops
// everything. Prints status lines only, never text.

const say = (line: string) => process.stdout.write(`[dev] ${line}\n`);

const run = async (): Promise<number> => {
  // The core serves the built settings page at /settings; a build takes well under a second.
  const page = Bun.spawnSync(["bun", "run", "--cwd", "apps/settings-web", "build"]);
  if (page.exitCode !== 0) say("settings page didn't build; /settings will answer 404");
  say("core starting. Settings: bun run settings. Ctrl-C stops everything.");
  const core = Bun.spawn(["bun", "run", "--cwd", "apps/core", "cli", "serve"], {
    env: process.env,
    stdio: ["inherit", "inherit", "inherit"],
  });
  const stop = () => core.kill("SIGTERM");
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  return core.exited;
};

process.exitCode = await run();
