// Test fixture: a real server with saved profiles in a temp settings file and an in-memory
// Keychain, so these tests never touch the real one.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import { ProfileProbeProvider } from "../providers";
import { isLocalUrl, type ModelConfig, SettingsFileRepository, SettingsService } from "../settings";
import { WebSocketServer } from "./websocket.server";

export const TOKEN = "q".repeat(43);
export const cloud = {
  name: "Cloud",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "qwen/qwen3.8-flash",
  reasoningEffort: null,
};

const memoryKeys = () => {
  const items = new Map<string, string>();
  return {
    items,
    get: async (id: string) => ok(items.get(id) ?? null),
    set: async (id: string, key: string) => {
      items.set(id, key);
      return ok(undefined);
    },
    remove: async (id: string) => {
      items.delete(id);
      return ok(undefined);
    },
  };
};

const startServer = (settings: SettingsService) => {
  const server = new WebSocketServer(
    { port: 0, token: TOKEN },
    {
      settingsView: () => settings.view(),
      profiles: settings,
      // Short timeouts so a test can make a probe time out quickly.
      probe: new ProfileProbeProvider(
        (id, url) => settings.savedKeyFor(id, url),
        new Logger(() => {}),
        fetch,
        { models: 1000, test: 300 },
      ),
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
  const started = server.start();
  if (!started.ok) throw new Error("server did not start");
  return { server, base: `http://127.0.0.1:${started.value.port}` };
};

/** Starts the server; model changes are broadcast as `settings.changed`, as in `core serve`. */
export const startProfilesServer = async (env = {}, envModel: ModelConfig | null = null) => {
  const dir = await mkdtemp(join(tmpdir(), "gc-profiles-"));
  const keys = memoryKeys();
  const opened = await SettingsService.open(
    new SettingsFileRepository(join(dir, "settings.json")),
    keys,
    env,
    envModel,
  );
  if (!opened.ok) throw new Error("settings did not open");
  const { server, base } = startServer(opened.value);
  const featureModel = (m: ModelConfig) => ({ model: m.model, local: isLocalUrl(m.baseUrl) });
  opened.value.onChange((models) =>
    server.broadcast({
      type: "settings.changed",
      check: featureModel(models.check),
      rephrase: featureModel(models.rephrase),
    }),
  );
  const api = (path: string, method = "GET", body?: unknown) =>
    fetch(`${base}${path}`, {
      method,
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const stop = async () => {
    server.stop();
    await rm(dir, { recursive: true, force: true });
  };
  return { server, base, dir, keys, api, stop };
};
