import { join } from "node:path";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import { Settings, TransportSettings } from "./settings.schema";

export type Env = Readonly<Record<string, string | undefined>>;

const appSupportDir = (homeDir: string): string =>
  join(homeDir, "Library", "Application Support", "GrammarChecker");

export const defaultDictionaryPath = (homeDir: string): string =>
  join(appSupportDir(homeDir), "dictionary.json");

export const defaultTokenPath = (homeDir: string): string => join(appSupportDir(homeDir), "token");

const blankToUndefined = (value: string | undefined): string | undefined =>
  value?.trim() ? value.trim() : undefined;

const transportInput = (env: Env, homeDir: string) => ({
  port: blankToUndefined(env.GC_PORT),
  tokenPath: blankToUndefined(env.GC_TOKEN_PATH) ?? defaultTokenPath(homeDir),
});

/** Reads GC_PORT and GC_TOKEN_PATH only, so `core token` works without model settings. */
export const loadTransportSettings = (
  env: Env,
  homeDir: string,
): Result<TransportSettings, AppError> => {
  const parsed = TransportSettings.safeParse(transportInput(env, homeDir));
  return parsed.success ? ok(parsed.data) : err(appError("settings_invalid"));
};

/** Reads GC_* variables. Pure: the caller passes the environment and home directory. */
export const loadSettings = (env: Env, homeDir: string): Result<Settings, AppError> => {
  const parsed = Settings.safeParse({
    ...transportInput(env, homeDir),
    baseUrl: blankToUndefined(env.GC_BASE_URL),
    model: blankToUndefined(env.GC_MODEL),
    apiKey: blankToUndefined(env.GC_API_KEY),
    dictionaryPath: blankToUndefined(env.GC_DICTIONARY_PATH) ?? defaultDictionaryPath(homeDir),
    reasoningEffort: blankToUndefined(env.GC_REASONING_EFFORT),
  });
  return parsed.success ? ok(parsed.data) : err(appError("settings_invalid"));
};
