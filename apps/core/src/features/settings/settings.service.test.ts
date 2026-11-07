import { describe, expect, test } from "bun:test";
import { appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import { firstRunFile } from "./profiles.util";
import type { ModelConfig } from "./settings.schema";
import { SettingsService } from "./settings.service";
import type { SettingsFile } from "./settings-file.schema";

/** An in-memory settings file; `failSave` makes the next save fail. */
const memoryStore = (initial: SettingsFile | null = null) => {
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

const ids = () => {
  let n = 0;
  return () => `p${++n}`;
};

const cloud = {
  name: "Cloud",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "qwen/qwen3.8-flash",
  reasoningEffort: null,
};

const open = async (store = memoryStore(), envModel: ModelConfig | null = null, env = {}) => {
  const opened = await SettingsService.open(store, env, envModel, ids());
  if (!opened.ok) throw new Error("open failed");
  const changes: ModelConfig[] = [];
  opened.value.onChange((config) => changes.push(config));
  return { service: opened.value, store, changes };
};

describe("SettingsService", () => {
  test("first run saves a Local profile and uses it", async () => {
    const { service, store } = await open();
    expect(store.saves).toBe(1);
    expect(service.current()).toEqual({
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "qwen3:8b",
      reasoningEffort: "none",
    });
    expect(service.view().check.model).toEqual({ value: "qwen3:8b", source: "saved" });
    expect(service.profiles()).toMatchObject({ activeProfileId: "p1", lockedByEnv: false });
  });

  test("a file saved before the built-in mark gets its first local profile marked", async () => {
    const { builtInProfileId: _, ...old } = firstRunFile("old");
    const store = memoryStore({ ...old, profiles: [{ ...cloud, id: "c" }, ...old.profiles] });
    const { service } = await open(store);
    expect(store.file?.builtInProfileId).toBe("old");
    expect(service.profiles().profiles.map((p) => [p.id, p.builtIn])).toEqual([
      ["c", false],
      ["old", true],
    ]);
  });

  test("an existing file is used as is", async () => {
    const { service, store } = await open(memoryStore(firstRunFile("old")));
    expect(store.saves).toBe(0);
    expect(service.profiles().activeProfileId).toBe("old");
  });

  test("creating a profile saves it, marks cloud vs local, and changes nothing in use", async () => {
    const { service, store, changes } = await open();
    const result = await service.create(cloud);
    expect(result.ok && result.value.profiles.map((p) => [p.name, p.local])).toEqual([
      ["Local", true],
      ["Cloud", false],
    ]);
    expect(store.file?.profiles).toHaveLength(2);
    expect(changes).toEqual([]);
  });

  test("activating another profile switches the model and tells the listeners once", async () => {
    const { service, changes } = await open();
    await service.create(cloud);
    await service.activate("p2");
    expect(changes).toEqual([
      { baseUrl: "https://openrouter.ai/api/v1", model: "qwen/qwen3.8-flash" },
    ]);
    expect(service.view().check.model.value).toBe("qwen/qwen3.8-flash");
  });

  test("editing the active profile switches the model; editing another one doesn't", async () => {
    const { service, changes } = await open();
    await service.create(cloud);
    await service.update("p2", { ...cloud, model: "other" });
    expect(changes).toEqual([]);
    await service.update("p1", { ...cloud, name: "Local", baseUrl: "http://127.0.0.1:1234/v1" });
    expect(changes.map((c) => c.baseUrl)).toEqual(["http://127.0.0.1:1234/v1"]);
  });

  test("a failed save changes nothing", async () => {
    const { service, store, changes } = await open();
    await service.create(cloud);
    store.failSave = true;
    expect(await service.activate("p2")).toEqual(err(appError("settings_write_failed")));
    expect(service.profiles().activeProfileId).toBe("p1");
    expect(changes).toEqual([]);
  });

  test("the active profile can't be removed, nor the built-in Local one", async () => {
    const { service } = await open();
    await service.create(cloud);
    await service.activate("p2");
    expect(await service.remove("p2")).toEqual(err(appError("profile_active")));
    expect(await service.remove("p1")).toEqual(err(appError("profile_builtin")));
  });

  test("env vars lock the model: shown as env, no active profile, activation refused", async () => {
    const envModel = { baseUrl: "https://openrouter.ai/api/v1", model: "env-model" };
    const env = { GC_BASE_URL: envModel.baseUrl, GC_MODEL: envModel.model };
    const { service, changes } = await open(memoryStore(), envModel, env);
    expect(service.current()).toEqual(envModel);
    expect(service.view().check.model).toEqual({
      value: "env-model",
      source: "env",
      envVar: "GC_MODEL",
    });
    expect(service.profiles()).toMatchObject({ activeProfileId: null, lockedByEnv: true });
    await service.create(cloud);
    expect(await service.activate("p2")).toEqual(err(appError("settings_locked")));
    await service.update("p1", { ...cloud, name: "Local" });
    expect(changes).toEqual([]);
  });
});
