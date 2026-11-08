import type { Feature, FeatureProfiles } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import type { Profile, SettingsFile } from "./settings-file.schema";

export const FEATURES: readonly Feature[] = ["check", "rephrase"];

/** What can use a profile: being the active one, or a feature mapped to it. */
export type ProfileUse = "active" | Feature;

const SAME_AS_ACTIVE: FeatureProfiles = { check: null, rephrase: null };

/** The profile each feature uses; null is "same as active", the default for older files. */
export const featureProfiles = (file: SettingsFile): FeatureProfiles =>
  file.features ?? SAME_AS_ACTIVE;

/** The profile a feature runs with: its own if mapped, else the active one. */
export const featureProfile = (file: SettingsFile, feature: Feature): Profile => {
  const id = featureProfiles(file)[feature] ?? file.activeProfileId;
  return (
    file.profiles.find((p) => p.id === id) ??
    file.profiles.find((p) => p.id === file.activeProfileId) ??
    (file.profiles[0] as Profile)
  );
};

/** Replaces the mapping; every id it names must be a saved profile. */
export const setFeatureProfiles = (
  file: SettingsFile,
  features: FeatureProfiles,
): Result<SettingsFile, AppError> => {
  const ids = FEATURES.map((f) => features[f]).filter((id): id is string => id !== null);
  if (ids.some((id) => !file.profiles.some((p) => p.id === id)))
    return err(appError("profile_not_found"));
  return ok({ ...file, features });
};

/** Everything that uses a profile, so the page can offer to move it to Local before a delete. */
export const profileUses = (file: SettingsFile, id: string): ProfileUse[] => {
  const mapped = FEATURES.filter((f) => featureProfiles(file)[f] === id);
  return file.activeProfileId === id ? ["active", ...mapped] : mapped;
};
