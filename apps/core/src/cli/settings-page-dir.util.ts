import { dirname, join } from "node:path";

/** Bun's virtual root for a `bun build --compile` binary (POSIX, and Windows-style). */
const isCompiled = (moduleDir: string): boolean =>
  moduleDir.startsWith("/$bunfs/") || moduleDir.includes("~BUN");

/**
 * Where the built settings page is: `GC_SETTINGS_PAGE_DIR` when set; for a compiled core, the
 * `settings` folder beside the binary (how the release archive lays it out); from source, the
 * settings-web build in this repo.
 */
export const settingsPageDir = (
  env: Readonly<Record<string, string | undefined>>,
  execPath: string,
  moduleDir: string,
): string => {
  const override = env.GC_SETTINGS_PAGE_DIR?.trim();
  if (override) return override;
  if (isCompiled(moduleDir)) return join(dirname(execPath), "settings");
  return join(moduleDir, "..", "..", "..", "settings-web", "dist");
};
