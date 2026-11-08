import { describe, expect, test } from "bun:test";
import { appError } from "../../shared/errors";
import { err } from "../../shared/result";
import { firstRunFile } from "./profiles.util";
import { cloud, memoryKeys, memoryStore, open } from "./settings-service.fixture";

describe("SettingsService API keys", () => {
  test("a key is saved in the Keychain only, shown as set, and sent with the active model", async () => {
    const { service, store, changes, keys } = await open();
    const created = await service.create({ ...cloud, apiKey: "sk-or-1" });
    expect(created.ok && created.value.profiles.map((p) => p.hasKey)).toEqual([false, true]);
    expect(keys.items.get("p2")).toBe("sk-or-1");
    expect(JSON.stringify(store.file)).not.toContain("sk-or");
    expect(JSON.stringify(created)).not.toContain("sk-or");
    await service.activate("p2");
    expect(changes.at(-1)?.apiKey).toBe("sk-or-1");
    expect(service.view().check.apiKey).toEqual({ set: true, source: "saved" });
  });

  test("replacing the active profile's key switches to it; absent keeps it; null removes it", async () => {
    const { service, changes, keys } = await open();
    await service.create({ ...cloud, apiKey: "sk-1" });
    await service.activate("p2");
    await service.update("p2", { ...cloud, apiKey: "sk-2" });
    expect(changes.at(-1)?.apiKey).toBe("sk-2");
    const count = changes.length;
    await service.update("p2", cloud);
    expect(changes).toHaveLength(count);
    expect(keys.items.get("p2")).toBe("sk-2");
    await service.update("p2", { ...cloud, apiKey: null });
    expect(keys.items.has("p2")).toBe(false);
    expect(changes.at(-1)?.apiKey).toBeUndefined();
    expect(service.profiles().profiles[1]?.hasKey).toBe(false);
  });

  test("deleting a profile deletes its key; a refused key saves nothing", async () => {
    const { service, keys, store } = await open();
    await service.create({ ...cloud, apiKey: "sk-1" });
    await service.remove("p2");
    expect(keys.items.size).toBe(0);
    keys.failSet = true;
    expect(await service.create({ ...cloud, apiKey: "sk-2" })).toEqual(
      err(appError("keychain_failed")),
    );
    expect(store.file?.profiles).toHaveLength(1);
  });

  test("keys already in the Keychain are found on open", async () => {
    const keys = memoryKeys();
    keys.items.set("old", "sk-old");
    const { service } = await open(memoryStore(firstRunFile("old")), null, {}, keys);
    expect(service.profiles().profiles[0]?.hasKey).toBe(true);
    expect((await service.current()).check.apiKey).toBe("sk-old");
  });

  test("a saved key is lent to a probe only on the profile's own host", async () => {
    const { service } = await open();
    await service.create({ ...cloud, apiKey: "sk-1" });
    expect(await service.savedKeyFor("p2", "https://openrouter.ai/api/v2")).toBe("sk-1");
    expect(await service.savedKeyFor("p2", "https://evil.example/api/v1")).toBeNull();
    expect(await service.savedKeyFor("p1", "http://127.0.0.1:11434/v1")).toBeNull();
    expect(await service.savedKeyFor(null, cloud.baseUrl)).toBeNull();
    expect(await service.savedKeyFor("gone", cloud.baseUrl)).toBeNull();
  });
});
