import { z } from "zod";
import { OllamaPullView } from "./ollama-pull.dto";

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
 * An API key as typed on the settings page: printable ASCII without quotes, backslashes or
 * spaces (every provider key fits).
 */
export const ApiKey = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[!#-[\]-~]+$/);

/**
 * Adding or replacing a profile. `apiKey`: a string sets or replaces its key, null removes it,
 * absent keeps it. The key goes to the Keychain, never to the settings file or a response.
 */
export const ProfileSave = z.strictObject({
  ...ProfileInput.shape,
  apiKey: ApiKey.nullable().optional(),
});
export type ProfileSave = z.infer<typeof ProfileSave>;

/**
 * A saved profile as the page shows it. `local`: its endpoint is on this Mac. `builtIn`: the
 * first-run "Local" profile, which can be edited but never deleted.
 */
export const ProfileView = z.strictObject({
  id: z.string().min(1),
  ...ProfileInput.shape,
  local: z.boolean(),
  builtIn: z.boolean(),
  /** Whether a key is saved in the Keychain. The key itself never leaves the core. */
  hasKey: z.boolean(),
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

/**
 * The local runtime as the page shows it. `inUse`: the model in use is on Ollama.
 * `startedByApp`: the core started it, so it stops it on a switch to cloud or on quit.
 * `pull`: the latest model pull (one at a time), null when none was started or it was cancelled.
 */
export const OllamaState = z.enum([
  "running",
  "starting",
  "not_running",
  "not_installed",
  "failed",
]);
export type OllamaState = z.infer<typeof OllamaState>;

export const RuntimeView = z.strictObject({
  ollama: z.strictObject({
    state: OllamaState,
    version: z.string().nullable(),
    models: z.array(z.string()),
    inUse: z.boolean(),
    startedByApp: z.boolean(),
    pull: OllamaPullView.nullable(),
  }),
});
export type RuntimeView = z.infer<typeof RuntimeView>;

/** `POST /api/token/rotate`: the new install token, for the page to keep and the user to paste. */
export const TokenView = z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{32,}$/) });
export type TokenView = z.infer<typeof TokenView>;
