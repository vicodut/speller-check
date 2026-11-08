import { describe, expect, test } from "bun:test";
import { appError } from "../../shared/errors";
import { err } from "../../shared/result";
import { cloud, memoryStore, open } from "./settings-service.fixture";

/** Local (p1, built-in, active) plus a keyed Cloud profile (p2). */
const withCloud = async () => {
  const ctx = await open();
  await ctx.service.create({ ...cloud, apiKey: "sk-cloud" });
  return ctx;
};

describe("a profile per feature", () => {
  test("both features follow the active profile until mapped", async () => {
    const { service } = await withCloud();
    expect(service.profiles().features).toEqual({ check: null, rephrase: null });
    const models = await service.current();
    expect(models.check).toEqual(models.rephrase);
  });

  test("mapping Rephrase switches only Rephrase, with its profile's key", async () => {
    const { service, store, switched } = await withCloud();
    await service.setFeatures({ check: null, rephrase: "p2" });
    expect(switched).toEqual([["rephrase"]]);
    const models = await service.current();
    expect(models.check.model).toBe("qwen3:8b");
    expect(models.rephrase).toMatchObject({ model: cloud.model, apiKey: "sk-cloud" });
    expect(service.view().rephrase.model).toEqual({ value: cloud.model, source: "saved" });
    expect(service.view().check.model).toEqual({ value: "qwen3:8b", source: "saved" });
    expect(store.file?.features).toEqual({ check: null, rephrase: "p2" });
  });

  test("activating another profile switches only the features that follow it", async () => {
    const { service, switched } = await withCloud();
    await service.setFeatures({ check: null, rephrase: "p1" });
    expect(switched).toEqual([]); // Rephrase was already on Local, the active profile.
    await service.activate("p2");
    expect(switched).toEqual([["check"]]);
  });

  test("a key change switches the features using that profile", async () => {
    const { service, switched } = await withCloud();
    await service.setFeatures({ check: null, rephrase: "p2" });
    await service.update("p2", { ...cloud, apiKey: "sk-new" });
    expect(switched.at(-1)).toEqual(["rephrase"]);
    expect((await service.current()).rephrase.apiKey).toBe("sk-new");
  });

  test("unknown ids are refused; a mapped profile can't be deleted", async () => {
    const { service } = await withCloud();
    expect(await service.setFeatures({ check: "ghost", rephrase: null })).toEqual(
      err(appError("profile_not_found")),
    );
    await service.setFeatures({ check: "p2", rephrase: null });
    expect(await service.remove("p2")).toEqual(err(appError("profile_in_use")));
  });

  test("env vars lock the mapping", async () => {
    const envModel = { baseUrl: "https://openrouter.ai/api/v1", model: "env-model" };
    const { service } = await open(memoryStore(), envModel);
    expect(await service.setFeatures({ check: null, rephrase: null })).toEqual(
      err(appError("settings_locked")),
    );
    const models = await service.current();
    expect([models.check, models.rephrase]).toEqual([envModel, envModel]);
  });
});
