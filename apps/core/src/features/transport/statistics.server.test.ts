import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type FeatureSettingsView, SettingsView, StatisticsView } from "@gc/protocol";
import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import { WebSocketServer } from "./websocket.server";

const TOKEN = "s".repeat(43);
const feature: FeatureSettingsView = {
  baseUrl: { value: "http://127.0.0.1:11434/v1", source: "saved" },
  model: { value: "qwen3:8b", source: "saved" },
  reasoningEffort: { value: null, source: "unset" },
  apiKey: { set: false, source: "unset" },
};
const cell = { msPerLetter: 4.8, okCount: 6, failureCount: 1, letters: 720 };
const row = {
  profileId: "p1",
  profileName: "Local",
  deleted: false,
  model: "qwen3:8b",
  local: true,
  check: cell,
  rephrase: { msPerLetter: null, okCount: 0, failureCount: 0, letters: 0 },
};
const cleared = { rows: [] };

let deleted = 0;
const server = new WebSocketServer(
  { port: 0, token: TOKEN },
  {
    settingsView: () => ({ check: feature, rephrase: feature }),
    createSession: () => ({ update: () => {}, close: () => {}, dispose: () => {} }),
    addDictionaryTerm: async () => ok(undefined),
    createRephraser: () => ({
      request: async () => {},
      edited: () => {},
      cancel: () => {},
      dispose: () => {},
    }),
    statistics: {
      view: () => ({ rows: [row] }),
      clear: async () => {
        deleted++;
        return ok(cleared);
      },
    },
  },
  new Logger(() => {}),
);
let base = "";
let port = 0;

beforeAll(() => {
  const started = server.start();
  if (!started.ok) throw new Error("server did not start");
  port = started.value.port;
  base = `http://127.0.0.1:${port}`;
});
afterAll(() => server.stop());

const auth = { authorization: `Bearer ${TOKEN}` };

describe("GET /api/statistics", () => {
  test("returns the rows, never cached", async () => {
    const response = await fetch(`${base}/api/statistics`, { headers: auth });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(StatisticsView.parse(await response.json())).toEqual({ rows: [row] });
  });

  test("needs the install token", async () => {
    const response = await fetch(`${base}/api/statistics`);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "auth_failed" });
  });

  test("refuses a foreign origin and a foreign host", async () => {
    const foreignOrigin = await fetch(`${base}/api/statistics`, {
      headers: { ...auth, origin: "https://example.com" },
    });
    expect(foreignOrigin.status).toBe(403);
    expect(await foreignOrigin.json()).toEqual({ error: "origin_forbidden" });

    const foreignHost = await fetch(`${base}/api/statistics`, {
      headers: { ...auth, host: "example.com" },
    });
    expect(foreignHost.status).toBe(403);
    expect(await foreignHost.json()).toEqual({ error: "host_forbidden" });
  });

  test("the settings endpoint is unaffected", async () => {
    const response = await fetch(`${base}/api/settings`, { headers: auth });
    expect(SettingsView.safeParse(await response.json()).success).toBe(true);
  });
});

describe("DELETE /api/statistics", () => {
  test("forgets every row and answers the empty view", async () => {
    const before = deleted;
    const response = await fetch(`${base}/api/statistics`, { method: "DELETE", headers: auth });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(cleared);
    expect(deleted).toBe(before + 1);
  });

  test("needs the install token and forgets nothing without it", async () => {
    const before = deleted;
    const response = await fetch(`${base}/api/statistics`, { method: "DELETE" });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "auth_failed" });
    expect(deleted).toBe(before);
  });

  test("refuses a foreign origin or host and forgets nothing", async () => {
    const before = deleted;
    const foreignOrigin = await fetch(`${base}/api/statistics`, {
      method: "DELETE",
      headers: { ...auth, origin: "https://example.com" },
    });
    expect(foreignOrigin.status).toBe(403);
    expect(await foreignOrigin.json()).toEqual({ error: "origin_forbidden" });

    const foreignHost = await fetch(`${base}/api/statistics`, {
      method: "DELETE",
      headers: { ...auth, host: "example.com" },
    });
    expect(foreignHost.status).toBe(403);
    expect(await foreignHost.json()).toEqual({ error: "host_forbidden" });
    expect(deleted).toBe(before);
  });

  test("other methods are refused", async () => {
    const response = await fetch(`${base}/api/statistics`, { method: "POST", headers: auth });
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: "method_not_allowed" });
  });
});
