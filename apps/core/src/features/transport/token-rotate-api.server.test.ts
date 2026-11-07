import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CoreMessage, type FeatureSettingsView, TokenView } from "@gc/protocol";
import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import { InstallTokenRepository } from "./install-token.repository";
import { InstallTokenWatcher } from "./install-token.watcher";
import { WebSocketServer } from "./websocket.server";

const feature: FeatureSettingsView = {
  baseUrl: { value: "http://127.0.0.1:11434/v1", source: "env", envVar: "GC_BASE_URL" },
  model: { value: "qwen3:8b", source: "env", envVar: "GC_MODEL" },
  reasoningEffort: { value: null, source: "unset" },
  apiKey: { set: false, source: "unset" },
};

let dir = "";
let server: WebSocketServer;
let base = "";
let oldToken = "";
const logs: string[] = [];

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "gc-rotate-api-"));
  const path = join(dir, "token");
  const repo = new InstallTokenRepository(path);
  const start = await repo.loadOrCreate();
  if (!start.ok) throw new Error("expected a token");
  oldToken = start.value;
  const watcher = new InstallTokenWatcher(path, start.value);
  const rotate = async () => {
    const rotated = await repo.rotate();
    if (rotated.ok) server.revokeAll();
    return rotated;
  };
  server = new WebSocketServer(
    { port: 0, token: () => watcher.current(), helloTimeoutMs: 500 },
    {
      settingsView: () => ({ check: feature, rephrase: feature }),
      tokens: { rotate },
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
  const started = server.start();
  if (!started.ok) throw new Error("server did not start");
  base = `http://127.0.0.1:${started.value.port}`;
});

afterAll(async () => {
  server.stop();
  await rm(dir, { recursive: true, force: true });
});

const post = (path: string, token: string, origin?: string) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, ...(origin ? { origin } : {}) },
  });

const apiStatus = async (token: string) =>
  (await fetch(`${base}/api/settings`, { headers: { authorization: `Bearer ${token}` } })).status;

/** An authenticated client that records what the core sends and whether it was closed. */
const client = async () => {
  const received: CoreMessage[] = [];
  let closed = false;
  const ws = new WebSocket(base.replace("http", "ws"));
  ws.onclose = () => {
    closed = true;
  };
  await new Promise<void>((resolve) => {
    ws.onopen = () => ws.send(JSON.stringify({ type: "hello", token: oldToken }));
    ws.onmessage = (event) => {
      received.push(JSON.parse(String(event.data)) as CoreMessage);
      resolve();
    };
  });
  return { received, closed: () => closed };
};

describe("POST /api/token/rotate", () => {
  test("refuses other methods, other origins and a wrong token, and rotates nothing", async () => {
    const get = await fetch(`${base}/api/token/rotate`, {
      headers: { authorization: `Bearer ${oldToken}` },
    });
    expect(get.status).toBe(405);
    expect((await post("/api/token/rotate", oldToken, "https://evil.example")).status).toBe(403);
    expect((await post("/api/token/rotate", "x".repeat(43))).status).toBe(401);
    expect(await apiStatus(oldToken)).toBe(200);
  });

  test("answers a new token, saves it, and the old one stops working at once", async () => {
    const extension = await client();
    expect(extension.received).toEqual([{ type: "ready" }]);

    const response = await post("/api/token/rotate", oldToken);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { token } = TokenView.parse(await response.json());
    expect(token).not.toBe(oldToken);
    expect(await readFile(join(dir, "token"), "utf8")).toBe(token);

    expect(await apiStatus(oldToken)).toBe(401);
    expect(await apiStatus(token)).toBe(200);

    await Bun.sleep(20);
    expect(extension.received).toContainEqual({ type: "error", code: "auth_failed" });
    expect(extension.closed()).toBe(true);
  });

  test("logs the rotation without the token", () => {
    expect(logs.some((line) => line.includes('"token.rotated"'))).toBe(true);
    expect(logs.join("\n")).not.toContain(oldToken);
  });
});
