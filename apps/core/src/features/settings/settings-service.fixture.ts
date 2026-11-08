import type { Feature } from "@gc/protocol";
// Test fixture: a SettingsService over an in-memory settings file and Keychain.
import { appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import type { ModelConfig } from "./settings.schema";
import { SettingsService } from "./settings.service";
import type { SettingsFile } from "./settings-file.schema";

/** An in-memory settings file; `failSave` makes the next save fail. */
export const memoryStore = (initial: SettingsFile | null = null) => {
  const store = {
    file: initial,
    saves: 0,
    failSave: false,
    load: async (): Promise<Result<SettingsFile | null, never>> => ok(store.file),
    save: async (file: SettingsFile) => {
      if (store.failSave) return err(appError("settings_write_failed"));
      store.saves++;
      store.file = file;
      return ok(undefined);
    },
  };
  return store;
};

/** An in-memory Keychain; `failSet` makes the next set fail. */
export const memoryKeys = () => {
  const keys = {
    items: new Map<string, string>(),
    failSet: false,
    get: async (id: string) => ok(keys.items.get(id) ?? null),
    set: async (id: string, key: string) => {
      if (keys.failSet) return err(appError("keychain_failed"));
      keys.items.set(id, key);
      return ok(undefined);
    },
    remove: async (id: string) => {
      keys.items.delete(id);
      return ok(undefined);
    },
  };
  return keys;
};

const ids = () => {
  let n = 0;
  return () => `p${++n}`;
};

export const cloud = {
  name: "Cloud",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "qwen/qwen3.8-flash",
  reasoningEffort: null,
};

export const open = async (
  store = memoryStore(),
  envModel: ModelConfig | null = null,
  env = {},
  keys = memoryKeys(),
) => {
  const opened = await SettingsService.open(store, keys, env, envModel, ids());
  if (!opened.ok) throw new Error("open failed");
  /** The Check model after each change, and which features each change switched. */
  const changes: ModelConfig[] = [];
  const switched: Feature[][] = [];
  opened.value.onChange((models, features) => {
    changes.push(models.check);
    switched.push([...features]);
  });
  return { service: opened.value, store, changes, switched, keys };
};
