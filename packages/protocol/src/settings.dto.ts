import { z } from "zod";

/** Sent as `reasoning_effort` when set; `none` turns off thinking on models like qwen3. */
export const ReasoningEffort = z.enum(["none", "low", "medium", "high"]);
export type ReasoningEffort = z.infer<typeof ReasoningEffort>;

/**
 * Where a setting's value comes from: an env var, the saved active profile, a built-in default,
 * or nothing (`unset`).
 */
export const SettingSource = z.enum(["env", "saved", "default", "unset"]);
export type SettingSource = z.infer<typeof SettingSource>;

/** The env var that set it, when `source` is `env` (e.g. `GC_MODEL`). */
const Origin = { source: SettingSource, envVar: z.string().min(1).optional() };

const sourced = <T extends z.ZodType>(value: T) => z.strictObject({ value, ...Origin });

/** One feature's model settings as the settings page shows them. */
export const FeatureSettingsView = z.strictObject({
  baseUrl: sourced(z.string().nullable()),
  model: sourced(z.string().nullable()),
  reasoningEffort: sourced(ReasoningEffort.nullable()),
  /** Whether a key is set, never the key itself: strict, so no value field can slip in. */
  apiKey: z.strictObject({ set: z.boolean(), ...Origin }),
});
export type FeatureSettingsView = z.infer<typeof FeatureSettingsView>;

/** `GET /api/settings`: the settings in effect for each feature. */
export const SettingsView = z.strictObject({
  check: FeatureSettingsView,
  rephrase: FeatureSettingsView,
});
export type SettingsView = z.infer<typeof SettingsView>;

/** Body of every HTTP API error response. */
export const ApiError = z.strictObject({ error: z.string().min(1) });
export type ApiError = z.infer<typeof ApiError>;

/** What you type for a profile on the settings page. Keys come later (#34), never in here. */
export const ProfileInput = z.strictObject({
  name: z.string().trim().min(1).max(60),
  /** OpenAI-compatible base URL, including the version prefix (e.g. http://127.0.0.1:11434/v1). */
  baseUrl: z.url({ protocol: /^https?$/ }),
  model: z.string().trim().min(1).max(200),
  reasoningEffort: ReasoningEffort.nullable(),
});
export type ProfileInput = z.infer<typeof ProfileInput>;

/**
 * A saved profile as the page shows it. `local`: its endpoint is on this Mac. `builtIn`: the
 * first-run "Local" profile, which can be edited but never deleted.
 */
export const ProfileView = z.strictObject({
  id: z.string().min(1),
  ...ProfileInput.shape,
  local: z.boolean(),
  builtIn: z.boolean(),
});
export type ProfileView = z.infer<typeof ProfileView>;

/**
 * `GET /api/profiles`, and the reply to every profile change. `lockedByEnv`: `GC_*` env vars are
 * set, so a temporary "Environment" profile is in use and saved ones can't be activated.
 */
export const ProfilesView = z.strictObject({
  profiles: z.array(ProfileView),
  activeProfileId: z.string().min(1).nullable(),
  lockedByEnv: z.boolean(),
});
export type ProfilesView = z.infer<typeof ProfilesView>;
