import type { FeatureSettingsView, SettingSource, SettingsView } from "@gc/protocol";
import type { Env } from "./settings.loader";
import type { Settings } from "./settings.schema";

/** The model settings a feature uses, by the env var that can set each one. */
const ENV_VARS = {
  baseUrl: "GC_BASE_URL",
  model: "GC_MODEL",
  apiKey: "GC_API_KEY",
  reasoningEffort: "GC_REASONING_EFFORT",
} as const;

export type SourcedSetting = keyof typeof ENV_VARS;

/** Where a setting comes from. The core has no model defaults yet: env, or nothing. */
const originOf = (env: Env, name: SourcedSetting) =>
  env[ENV_VARS[name]]?.trim()
    ? ({ source: "env", envVar: ENV_VARS[name] } as const)
    : ({ source: "unset" } as const);

const featureView = (env: Env, settings: Settings): FeatureSettingsView => ({
  baseUrl: { value: settings.baseUrl, ...originOf(env, "baseUrl") },
  model: { value: settings.model, ...originOf(env, "model") },
  reasoningEffort: {
    value: settings.reasoningEffort ?? null,
    ...originOf(env, "reasoningEffort"),
  },
  apiKey: { set: settings.apiKey !== undefined, ...originOf(env, "apiKey") },
});

/**
 * The settings in effect, each with its source, as the settings page shows them. Pure. Never
 * includes the API key, only whether one is set.
 */
export const buildSettingsView = (env: Env, settings: Settings): SettingsView => {
  const feature = featureView(env, settings);
  // One setup drives both features until profiles can map them separately (#36).
  return { check: feature, rephrase: feature };
};

/** Each setting's source only, for the `settings.loaded` log line. */
export const settingSources = (
  feature: FeatureSettingsView,
): Record<SourcedSetting, SettingSource> => ({
  baseUrl: feature.baseUrl.source,
  model: feature.model.source,
  apiKey: feature.apiKey.source,
  reasoningEffort: feature.reasoningEffort.source,
});
