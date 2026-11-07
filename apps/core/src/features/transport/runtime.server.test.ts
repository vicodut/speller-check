import { afterAll, describe, expect, test } from "bun:test";
import { type RuntimeView, RuntimeView as RuntimeViewSchema } from "@gc/protocol";
import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import { WebSocketServer } from "./websocket.server";

const TOKEN = "r".repeat(43);
let starts = 0;
let state: RuntimeView["ollama"]["state"] = "not_running";
const runtime = {
  view: async (): Promise<RuntimeView> => ({
    ollama: {
      state,
      version: state === "running" ? "0.40.13" : null,
      models: [],
      inUse: true,
      startedByApp: starts > 0,
    },
  }),
  ensureRunning: async () => {
    starts++;
    state = "running";
  },
};

const server = new WebSocketServer(
  { port: 0, token: TOKEN },
  {
    settingsView: () => {
      throw new Error("not used");
    },
    runtime,
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
const base = `http://127.0.0.1:${started.value.port}`;
afterAll(() => server.stop());

const api = (path: string, method = "GET", token = TOKEN) =>
  fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${token}` } });

describe("runtime over HTTP", () => {
  test("GET /api/runtime reports Ollama; POST .../start starts it and reports again", async () => {
    const before = RuntimeViewSchema.parse(await (await api("/api/runtime")).json());
    expect(before.ollama.state).toBe("not_running");
    const after = RuntimeViewSchema.parse(
      await (await api("/api/runtime/ollama/start", "POST")).json(),
    );
    expect(after.ollama).toMatchObject({
      state: "running",
      version: "0.40.13",
      startedByApp: true,
    });
    expect(starts).toBe(1);
  });

  test("needs the token, the right method and a known path", async () => {
    expect((await api("/api/runtime/ollama/start", "POST", "x".repeat(43))).status).toBe(401);
    expect((await api("/api/runtime/ollama/start")).status).toBe(405);
    expect((await api("/api/runtime/ollama/stop", "POST")).status).toBe(404);
    expect(starts).toBe(1);
  });
});
