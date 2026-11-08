import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type CoreMessage, ProfilesView, SettingsView } from "@gc/protocol";
import { cloud, startProfilesServer, TOKEN } from "./profiles-server.fixture";

let ctx: Awaited<ReturnType<typeof startProfilesServer>>;
const api = (path: string, method = "GET", body?: unknown) => ctx.api(path, method, body);

/** An authenticated WebSocket client that records what the core sends. */
const client = async () => {
  const received: CoreMessage[] = [];
  const ws = new WebSocket(ctx.base.replace("http", "ws"));
  await new Promise<void>((resolve) => {
    ws.onopen = () => ws.send(JSON.stringify({ type: "hello", token: TOKEN }));
    ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as CoreMessage;
      received.push(message);
      if (message.type === "ready") resolve();
    };
  });
  return { received, close: () => ws.close() };
};

beforeAll(async () => {
  ctx = await startProfilesServer();
});
afterAll(() => ctx.stop());

describe("profiles over HTTP", () => {
  test("first run lists the saved Local profile as active", async () => {
    const view = ProfilesView.parse(await (await api("/api/profiles")).json());
    expect(view.lockedByEnv).toBe(false);
    expect(view.profiles.map((p) => [p.name, p.local])).toEqual([["Local", true]]);
    expect(view.activeProfileId).toBe(view.profiles[0]?.id ?? "");
  });

  test("creating, editing and activating a profile saves it and switches the model live", async () => {
    const watcher = await client();
    const created = ProfilesView.parse(await (await api("/api/profiles", "POST", cloud)).json());
    const id = created.profiles.find((p) => p.name === "Cloud")?.id ?? "";
    expect(created.profiles.find((p) => p.id === id)?.local).toBe(false);

    const renamed = await api(`/api/profiles/${id}`, "PUT", { ...cloud, name: "OpenRouter" });
    expect(renamed.status).toBe(200);

    const activated = await api(`/api/profiles/${id}/activate`, "POST");
    expect(ProfilesView.parse(await activated.json()).activeProfileId).toBe(id);
    const settings = SettingsView.parse(await (await api("/api/settings")).json());
    expect(settings.check.model).toEqual({ value: "qwen/qwen3.8-flash", source: "saved" });

    await Bun.sleep(20);
    const cloudModel = { model: "qwen/qwen3.8-flash", local: false, provider: "openrouter.ai" };
    expect(watcher.received).toContainEqual({
      type: "settings.changed",
      check: cloudModel,
      rephrase: cloudModel,
    });
    watcher.close();

    const saved = JSON.parse(await readFile(join(ctx.dir, "settings.json"), "utf8"));
    expect(saved.activeProfileId).toBe(id);
    expect(JSON.stringify(saved)).not.toContain("apiKey");
  });

  test("neither the active nor the built-in profile can be deleted; another one can", async () => {
    const added = ProfilesView.parse(await (await api("/api/profiles", "POST", cloud)).json());
    const active = added.activeProfileId ?? "";
    const builtIn = added.profiles.find((p) => p.builtIn)?.id ?? "";
    const spare = added.profiles.find((p) => p.id !== active && !p.builtIn)?.id ?? "";
    const refused = await api(`/api/profiles/${active}`, "DELETE");
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "profile_active" });
    const local = await api(`/api/profiles/${builtIn}`, "DELETE");
    expect(local.status).toBe(409);
    expect(await local.json()).toEqual({ error: "profile_builtin" });
    expect((await api(`/api/profiles/${spare}`, "DELETE")).status).toBe(200);
  });

  test("mapping a feature saves it and tells clients each feature's model", async () => {
    const watcher = await client();
    const before = ProfilesView.parse(await (await api("/api/profiles")).json());
    const local = before.profiles.find((p) => p.builtIn)?.id ?? "";
    const mapped = await api("/api/profiles/features", "PUT", { check: local, rephrase: null });
    expect(ProfilesView.parse(await mapped.json()).features).toEqual({
      check: local,
      rephrase: null,
    });
    const settings = SettingsView.parse(await (await api("/api/settings")).json());
    expect(settings.check.model.value).toBe("qwen3:8b");
    await Bun.sleep(20);
    expect(watcher.received).toContainEqual({
      type: "settings.changed",
      check: { model: "qwen3:8b", local: true, provider: "127.0.0.1" },
      rephrase: {
        model: before.profiles.find((p) => p.id === before.activeProfileId)?.model ?? "",
        local: false,
        provider: "openrouter.ai",
      },
    });
    watcher.close();
    const saved = JSON.parse(await readFile(join(ctx.dir, "settings.json"), "utf8"));
    expect(saved.features).toEqual({ check: local, rephrase: null });
    expect((await api(`/api/profiles/${local}`, "DELETE")).status).toBe(409);
    expect(
      (await api("/api/profiles/features", "PUT", { check: "ghost", rephrase: null })).status,
    ).toBe(404);
    expect((await api("/api/profiles/features", "PUT", { check: local })).status).toBe(400);
    expect((await api("/api/profiles/features")).status).toBe(405);
    await api("/api/profiles/features", "PUT", { check: null, rephrase: null });
  });

  test("bad input and unknown ids are refused", async () => {
    const invalid = await api("/api/profiles", "POST", { ...cloud, apiKey: 'has "quotes"' });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "body_invalid" });
    const extra = await api("/api/profiles", "POST", { ...cloud, token: "x" });
    expect(extra.status).toBe(400);
    expect((await api("/api/profiles/nope/activate", "POST")).status).toBe(404);
    expect((await api("/api/profiles", "DELETE")).status).toBe(405);
  });

  test("an unauthenticated client never receives settings.changed", async () => {
    const ws = new WebSocket(ctx.base.replace("http", "ws"));
    const received: string[] = [];
    ws.onmessage = (event) => received.push(String(event.data));
    await new Promise((resolve) => {
      ws.onopen = resolve;
    });
    const local = { model: "m", local: true };
    ctx.server.broadcast({ type: "settings.changed", check: local, rephrase: local });
    await Bun.sleep(20);
    expect(received).toEqual([]);
    ws.close();
  });
});
