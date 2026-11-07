import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type FeatureSettingsView, SettingsView } from "@gc/protocol";
import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import { WebSocketServer } from "./websocket.server";

const TOKEN = "h".repeat(43);
const feature: FeatureSettingsView = {
  baseUrl: { value: "https://openrouter.ai/api/v1", source: "env", envVar: "GC_BASE_URL" },
  model: { value: "qwen/qwen3.8-flash", source: "env", envVar: "GC_MODEL" },
  reasoningEffort: { value: null, source: "unset" },
  apiKey: { set: true, source: "env", envVar: "GC_API_KEY" },
};
const view = { check: feature, rephrase: feature };
const logs: string[] = [];

const server = new WebSocketServer(
  { port: 0, token: TOKEN },
  {
    settingsView: () => view,
    createSession: () => ({ update: () => {}, close: () => {}, dispose: () => {} }),
    addDictionaryTerm: async () => ok(undefined),
    createRephraser: () => ({
      request: async () => {},
      edited: () => {},
      cancel: () => {},
      dispose: () => {},
    }),
  },
  new Logger((line) => logs.push(line)),
);
let base = "";

beforeAll(() => {
  const started = server.start();
  if (!started.ok) throw new Error("server did not start");
  base = `http://127.0.0.1:${started.value.port}`;
});
afterAll(() => server.stop());

const get = (path: string, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { headers: { authorization: `Bearer ${TOKEN}`, ...headers } });

describe("GET /api/settings", () => {
  test("returns the settings in effect with their sources", async () => {
    const response = await get("/api/settings");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = SettingsView.parse(await response.json());
    expect(body.check.model).toEqual({
      value: "qwen/qwen3.8-flash",
      source: "env",
      envVar: "GC_MODEL",
    });
    expect(body.check.apiKey).toEqual({ set: true, source: "env", envVar: "GC_API_KEY" });
  });

  test("is allowed from the core's own page", async () => {
    const response = await get("/api/settings", { origin: base });
    expect(response.status).toBe(200);
  });

  test("refuses a missing or wrong token", async () => {
    expect((await fetch(`${base}/api/settings`)).status).toBe(401);
    const wrong = await get("/api/settings", { authorization: `Bearer ${"x".repeat(43)}` });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: "auth_failed" });
  });

  test("refuses a website's Origin even with the right token", async () => {
    const response = await get("/api/settings", { origin: "https://evil.example" });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "origin_forbidden" });
  });

  test("refuses another Host name (DNS rebinding) even with the right token", async () => {
    const response = await get("/api/settings", { host: "evil.example" });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "host_forbidden" });
  });

  test("answers 404 for an unknown path and 405 for another method", async () => {
    expect((await get("/api/nope")).status).toBe(404);
    const post = await fetch(`${base}/api/settings`, {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(post.status).toBe(405);
  });

  test("logs rejections by code only", () => {
    const rejected = logs.filter((l) => l.includes("http.rejected"));
    expect(rejected.length).toBeGreaterThan(0);
    for (const line of rejected)
      expect(Object.keys(JSON.parse(line)).sort()).toEqual(["code", "event", "level"]);
  });
});

describe("the WebSocket next to the API", () => {
  test("still upgrades on the same port", async () => {
    const ws = new WebSocket(base.replace("http", "ws"));
    const opened = await new Promise<boolean>((resolve) => {
      ws.onopen = () => resolve(true);
      ws.onerror = () => resolve(false);
    });
    ws.close();
    expect(opened).toBe(true);
  });
});
