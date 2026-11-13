import type { Feature } from "@gc/protocol";
import { featureProfile } from "./feature-profiles.util";
import type { ModelConfig } from "./settings.schema";
import type { Profile, SettingsFile } from "./settings-file.schema";

/** The profile id a model with no saved profile (the `GC_*` env vars) reports in the statistics. */
export const ENVIRONMENT_PROFILE_ID = "environment";

/** A profile as the providers take it, without its key (read from the Keychain when needed). */
export const toConfig = (p: Profile): ModelConfig => ({
  baseUrl: p.baseUrl.replace(/\/+$/, ""),
  model: p.model,
  profileId: p.id,
  ...(p.reasoningEffort ? { reasoningEffort: p.reasoningEffort } : {}),
});

/** A feature's model without its key, as the core runs it: the env one when given, else its profile. */
export const modelInUse = (
  file: SettingsFile,
  envModel: ModelConfig | null,
  feature: Feature,
): ModelConfig => envModel ?? toConfig(featureProfile(file, feature));
