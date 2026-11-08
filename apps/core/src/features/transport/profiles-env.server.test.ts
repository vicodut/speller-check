import { describe, expect, test } from "bun:test";
import { ProfilesView, SettingsView } from "@gc/protocol";
import { startProfilesServer } from "./profiles-server.fixture";

describe("profiles while GC_* env vars give the model", () => {
  test("are listed as locked, and activation is refused", async () => {
    const envModel = { baseUrl: "http://127.0.0.1:11434/v1", model: "env-model" };
    const env = { GC_BASE_URL: envModel.baseUrl, GC_MODEL: envModel.model };
    const { api, stop } = await startProfilesServer(env, envModel);
    const view = ProfilesView.parse(await (await api("/api/profiles")).json());
    expect(view).toMatchObject({ lockedByEnv: true, activeProfileId: null });
    const id = view.profiles[0]?.id ?? "";
    const refused = await api(`/api/profiles/${id}/activate`, "POST");
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "settings_locked" });
    const mapping = await api("/api/profiles/features", "PUT", { check: null, rephrase: null });
    expect(mapping.status).toBe(409);
    expect(await mapping.json()).toEqual({ error: "settings_locked" });
    const settings = SettingsView.parse(await (await api("/api/settings")).json());
    expect(settings.check.model).toEqual({ value: "env-model", source: "env", envVar: "GC_MODEL" });
    await stop();
  });
});
