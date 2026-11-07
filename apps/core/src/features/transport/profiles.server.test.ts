import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CoreMessage, ProfilesView, SettingsView } from "@gc/protocol";
import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import { isLocalUrl, SettingsFileRepository, SettingsService } from "../settings";
import { WebSocketServer } from "./websocket.server";

const TOKEN = "q".repeat(43);
const cloud = {
  name: "Cloud",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "qwen/qwen3.8-flash",
  reasoningEffort: null,
};

let dir = "";
let base = "";
let server: WebSocketServer;
let service: SettingsService;

const startServer = (settings: SettingsService) => {
  const s = new WebSocketServer(
    { port: 0, token: TOKEN },
    {
      settingsView: () => settings.view(),
      profiles: settings,
      createSession: () => ({ update: () => {}, close: () => {}, dispose: () => {} }),
      addDictionaryTerm: async () => ok(undefined),
      createRephraser: () => ({
        request: async () => {},
        edited: () => {},
        cancel: () => {},
        dispose: () => {},
      }),
    },
    new Logger(() => {}),
  );
  const started = s.start();
  if (!started.ok) throw new Error("server did not start");
  return { server: s, base: `http://127.0.0.1:${started.value.port}` };
};

const api = (path: string, method = "GET", body?: unknown, at = base) =>
  fetch(`${at}${path}`, {
    method,
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

/** An authenticated WebSocket client that records what the core sends. */
const client = async () => {
  const received: CoreMessage[] = [];
  const ws = new WebSocket(base.replace("http", "ws"));
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
  dir = await mkdtemp(join(tmpdir(), "gc-profiles-"));
  const opened = await SettingsService.open(
    new SettingsFileRepository(join(dir, "settings.json")),
    {},
    null,
  );
  if (!opened.ok) throw new Error("settings did not open");
  service = opened.value;
  ({ server, base } = startServer(service));
  service.onChange((model) =>
    server.broadcast({
      type: "settings.changed",
      model: model.model,
      local: isLocalUrl(model.baseUrl),
    }),
  );
});

afterAll(async () => {
  server.stop();
  await rm(dir, { recursive: true, force: true });
});

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

    const saved = JSON.parse(await readFile(join(dir, "settings.json"), "utf8"));
    expect(saved.activeProfileId).toBe(id);
    expect(JSON.stringify(saved)).not.toContain("apiKey");
  });

  test("the active profile can't be deleted; another one can", async () => {
    const view = ProfilesView.parse(await (await api("/api/profiles")).json());
    const active = view.activeProfileId ?? "";
    const other = view.profiles.find((p) => p.id !== active)?.id ?? "";
    const refused = await api(`/api/profiles/${active}`, "DELETE");
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "profile_active" });
    expect((await api(`/api/profiles/${other}`, "DELETE")).status).toBe(200);
  });

  test("bad input and unknown ids are refused", async () => {
    const invalid = await api("/api/profiles", "POST", { ...cloud, apiKey: "sk-secret" });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "body_invalid" });
    expect((await api("/api/profiles/nope/activate", "POST")).status).toBe(404);
    expect((await api("/api/profiles", "DELETE")).status).toBe(405);
  });

  test("an unauthenticated client never receives settings.changed", async () => {
    const ws = new WebSocket(base.replace("http", "ws"));
    const received: string[] = [];
    ws.onmessage = (event) => received.push(String(event.data));
    await new Promise((resolve) => {
      ws.onopen = resolve;
    });
    server.broadcast({ type: "settings.changed", model: "m", local: true });
    await Bun.sleep(20);
    expect(received).toEqual([]);
    ws.close();
  });
});

describe("profiles while GC_* env vars give the model", () => {
  test("are listed as locked, and activation is refused", async () => {
    const lockedDir = await mkdtemp(join(tmpdir(), "gc-profiles-locked-"));
    const envModel = { baseUrl: "http://127.0.0.1:11434/v1", model: "env-model" };
    const opened = await SettingsService.open(
      new SettingsFileRepository(join(lockedDir, "settings.json")),
      { GC_BASE_URL: envModel.baseUrl, GC_MODEL: envModel.model },
      envModel,
    );
    if (!opened.ok) throw new Error("settings did not open");
    const locked = startServer(opened.value);
    const view = ProfilesView.parse(
      await (await api("/api/profiles", "GET", undefined, locked.base)).json(),
    );
    expect(view).toMatchObject({ lockedByEnv: true, activeProfileId: null });
    const id = view.profiles[0]?.id ?? "";
    const refused = await api(`/api/profiles/${id}/activate`, "POST", undefined, locked.base);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "settings_locked" });
    const settings = SettingsView.parse(
      await (await api("/api/settings", "GET", undefined, locked.base)).json(),
    );
    expect(settings.check.model).toEqual({ value: "env-model", source: "env", envVar: "GC_MODEL" });
    locked.server.stop();
    await rm(lockedDir, { recursive: true, force: true });
  });
});
