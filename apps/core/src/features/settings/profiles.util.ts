import type { ProfileInput } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import type { Profile, SettingsFile } from "./settings-file.schema";

/** First run: Ollama on this Mac with the benchmarked local model, thinking off (qwen3 on CPU). */
export const firstRunFile = (id: string): SettingsFile => ({
  version: 1,
  activeProfileId: id,
  builtInProfileId: id,
  profiles: [
    {
      id,
      name: "Local",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "qwen3:8b",
      reasoningEffort: "none",
    },
  ],
});

/** The active profile; the settings file schema guarantees it exists. */
export const activeProfile = (file: SettingsFile): Profile =>
  file.profiles.find((p) => p.id === file.activeProfileId) ?? (file.profiles[0] as Profile);

export const addProfile = (file: SettingsFile, input: ProfileInput, id: string): SettingsFile => ({
  ...file,
  profiles: [...file.profiles, { id, ...input }],
});

const known = (file: SettingsFile, id: string): Result<null, AppError> =>
  file.profiles.some((p) => p.id === id) ? ok(null) : err(appError("profile_not_found"));

export const updateProfile = (
  file: SettingsFile,
  id: string,
  input: ProfileInput,
): Result<SettingsFile, AppError> => {
  const found = known(file, id);
  if (!found.ok) return found;
  return ok({ ...file, profiles: file.profiles.map((p) => (p.id === id ? { id, ...input } : p)) });
};

/** The active profile can't be removed (activate another one first), nor the built-in one. */
export const removeProfile = (file: SettingsFile, id: string): Result<SettingsFile, AppError> => {
  const found = known(file, id);
  if (!found.ok) return found;
  if (file.builtInProfileId === id) return err(appError("profile_builtin"));
  if (file.activeProfileId === id) return err(appError("profile_active"));
  return ok({ ...file, profiles: file.profiles.filter((p) => p.id !== id) });
};

export const activateProfile = (file: SettingsFile, id: string): Result<SettingsFile, AppError> => {
  const found = known(file, id);
  return found.ok ? ok({ ...file, activeProfileId: id }) : found;
};

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** Whether an endpoint runs on this Mac, so text never leaves it. Derived, never typed in. */
/** A file saved before the built-in mark: its first local profile becomes the built-in one. */
export const markBuiltIn = (file: SettingsFile): SettingsFile => {
  if (file.builtInProfileId) return file;
  const local = file.profiles.find((p) => isLocalUrl(p.baseUrl));
  return local ? { ...file, builtInProfileId: local.id } : file;
};

export const isLocalUrl = (url: string): boolean => {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
};
