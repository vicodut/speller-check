import { z } from "zod";

export const DEFAULT_PORT = 7341;

/** Extension settings, stored in chrome.storage.local under `settingsStorageKey`. */
export const ExtensionSettings = z.object({
  token: z.string().default(""),
  port: z.number().int().min(1).max(65535).default(DEFAULT_PORT),
  /** Hostnames; a hostname also blocks its subdomains. */
  blockedSites: z.array(z.string()).default([]),
});
export type ExtensionSettings = z.infer<typeof ExtensionSettings>;

export const defaultSettings = (): ExtensionSettings => ({
  token: "",
  port: DEFAULT_PORT,
  blockedSites: [],
});
