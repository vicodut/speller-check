import { join } from "node:path";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import { Settings } from "./settings.schema";

export type Env = Readonly<Record<string, string | undefined>>;

export const defaultDictionaryPath = (homeDir: string): string =>
  join(homeDir, "Library", "Application Support", "GrammarChecker", "dictionary.json");

const blankToUndefined = (value: string | undefined): string | undefined =>
  value?.trim() ? value.trim() : undefined;

/** Reads GC_* variables. Pure: the caller passes the environment and home directory. */
export const loadSettings = (env: Env, homeDir: string): Result<Settings, AppError> => {
  const parsed = Settings.safeParse({
    baseUrl: blankToUndefined(env.GC_BASE_URL),
    model: blankToUndefined(env.GC_MODEL),
    apiKey: blankToUndefined(env.GC_API_KEY),
    dictionaryPath: blankToUndefined(env.GC_DICTIONARY_PATH) ?? defaultDictionaryPath(homeDir),
    reasoningEffort: blankToUndefined(env.GC_REASONING_EFFORT),
  });
  return parsed.success ? ok(parsed.data) : err(appError("settings_invalid"));
};
