import type { ModelConfig } from "./settings.schema";
import type { Profile } from "./settings-file.schema";

/** A profile as the providers take it, without its key (read from the Keychain when needed). */
export const toConfig = (p: Profile): ModelConfig => ({
  baseUrl: p.baseUrl.replace(/\/+$/, ""),
  model: p.model,
  ...(p.reasoningEffort ? { reasoningEffort: p.reasoningEffort } : {}),
});
