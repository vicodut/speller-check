import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** A child process this app started. */
export type RunningProcess = { kill(): void; readonly exited: Promise<number> };

/** Finds and starts `ollama serve`; the only code here that touches processes. */
export type OllamaLauncher = {
  find(): string | null;
  start(binary: string): RunningProcess;
};

/** Where Ollama installs its CLI: on PATH, the user install, or inside Ollama.app. */
const CANDIDATES = [
  join(homedir(), ".local", "bin", "ollama"),
  "/usr/local/bin/ollama",
  "/opt/homebrew/bin/ollama",
  "/Applications/Ollama.app/Contents/Resources/ollama",
];

export class OllamaProcessLauncher implements OllamaLauncher {
  find(): string | null {
    return Bun.which("ollama") ?? CANDIDATES.find((path) => existsSync(path)) ?? null;
  }

  /** Bound to 127.0.0.1 explicitly, whatever the user's OLLAMA_HOST says. Output discarded. */
  start(binary: string): RunningProcess {
    const child = Bun.spawn([binary, "serve"], {
      env: { ...process.env, OLLAMA_HOST: "127.0.0.1:11434" },
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    return { kill: () => child.kill(), exited: child.exited };
  }
}
