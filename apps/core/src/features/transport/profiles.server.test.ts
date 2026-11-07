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
    expect(watcher.received).toContainEqual({
      type: "settings.changed",
      model: "qwen/qwen3.8-flash",
      local: false,
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
    ctx.server.broadcast({ type: "settings.changed", model: "m", local: true });
    await Bun.sleep(20);
    expect(received).toEqual([]);
    ws.close();
  });
});
