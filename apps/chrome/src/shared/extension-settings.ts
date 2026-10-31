import { defaultSettings, ExtensionSettings } from "./extension-settings.schema";

export const settingsStorageKey = "settings";

/** Validates stored data; anything missing or invalid falls back to the defaults. */
export const parseSettings = (raw: unknown): ExtensionSettings => {
  const parsed = ExtensionSettings.safeParse(raw ?? {});
  return parsed.success ? parsed.data : defaultSettings();
};

export const loadSettings = async (): Promise<ExtensionSettings> => {
  try {
    const stored = await chrome.storage.local.get(settingsStorageKey);
    return parseSettings(stored[settingsStorageKey]);
  } catch {
    return defaultSettings();
  }
};

export const saveSettings = async (settings: ExtensionSettings): Promise<void> => {
  await chrome.storage.local.set({ [settingsStorageKey]: ExtensionSettings.parse(settings) });
};

/** Calls `listener` with fresh settings whenever they change in storage. */
export const onSettingsChanged = (listener: (settings: ExtensionSettings) => void): void => {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !(settingsStorageKey in changes)) return;
    listener(parseSettings(changes[settingsStorageKey]?.newValue));
  });
};
