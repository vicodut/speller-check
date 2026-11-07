import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CoreMessage, FeatureSettingsView } from "@gc/protocol";
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
let repo: InstallTokenRepository;
let server: WebSocketServer;
let base = "";
let oldToken = "";

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "gc-rotate-"));
  const path = join(dir, "token");
  repo = new InstallTokenRepository(path);
  const start = await repo.loadOrCreate();
  if (!start.ok) throw new Error("expected a token");
  oldToken = start.value;
  const watcher = new InstallTokenWatcher(path, start.value);
  server = new WebSocketServer(
    { port: 0, token: () => watcher.current(), helloTimeoutMs: 500 },
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
    },
    new Logger(() => {}),
  );
  const started = server.start();
  if (!started.ok) throw new Error("server did not start");
  base = `http://127.0.0.1:${started.value.port}`;
});

afterAll(async () => {
  server.stop();
  await rm(dir, { recursive: true, force: true });
});

const apiStatus = async (token: string) =>
  (await fetch(`${base}/api/settings`, { headers: { authorization: `Bearer ${token}` } })).status;

/** The core's first reply to a hello with `token`: `ready` or an `auth_failed` error. */
const helloReply = (token: string): Promise<CoreMessage> =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(base.replace("http", "ws"));
    ws.onopen = () => ws.send(JSON.stringify({ type: "hello", token }));
    ws.onmessage = (event) => {
      resolve(JSON.parse(String(event.data)) as CoreMessage);
      ws.close();
    };
    ws.onerror = () => reject(new Error("connection failed"));
  });

describe("a running core after core token --rotate", () => {
  test("accepts the token it started with", async () => {
    expect(await apiStatus(oldToken)).toBe(200);
    expect(await helloReply(oldToken)).toEqual({ type: "ready" });
  });

  test("refuses the old token and accepts the new one, without a restart", async () => {
    const rotated = await repo.rotate();
    if (!rotated.ok) throw new Error("expected a rotated token");
    expect(await apiStatus(oldToken)).toBe(401);
    expect(await helloReply(oldToken)).toEqual({ type: "error", code: "auth_failed" });
    expect(await apiStatus(rotated.value)).toBe(200);
    expect(await helloReply(rotated.value)).toEqual({ type: "ready" });
  });

  test("refuses every token once the token file is gone (fails closed)", async () => {
    await rm(join(dir, "token"));
    expect(await apiStatus(oldToken)).toBe(401);
    expect(await helloReply(oldToken)).toEqual({ type: "error", code: "auth_failed" });
  });
});
