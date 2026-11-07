import { afterAll, describe, expect, test } from "bun:test";
import {
  type OllamaPullView,
  type RuntimeView,
  RuntimeView as RuntimeViewSchema,
} from "@gc/protocol";
import { appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok } from "../../shared/result";
import { WebSocketServer } from "./websocket.server";

const TOKEN = "r".repeat(43);
let starts = 0;
let state: RuntimeView["ollama"]["state"] = "not_running";
let pull: OllamaPullView | null = null;
const runtime = {
  view: async (): Promise<RuntimeView> => ({
    ollama: {
      state,
      version: state === "running" ? "0.40.13" : null,
      models: [],
      inUse: true,
      startedByApp: starts > 0,
      pull,
    },
  }),
  ensureRunning: async () => {
    starts++;
    state = "running";
  },
  pull: async (model: string) => {
    if (pull?.step === "downloading") return err(appError("pull_in_progress"));
    pull = { model, step: "downloading", completed: 0, total: 10, error: null };
    return ok(undefined);
  },
  cancelPull: () => {
    pull = null;
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

const api = (path: string, method = "GET", token = TOKEN, body?: unknown) =>
  fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const PULL = "/api/runtime/ollama/pull";

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
    expect((await api(PULL, "POST", "x".repeat(43), { model: "qwen3:8b" })).status).toBe(401);
    expect((await api(PULL, "PUT")).status).toBe(405);
    expect(starts).toBe(1);
  });

  test("POST .../pull starts a pull, a second one is refused, DELETE cancels it", async () => {
    const response = await api(PULL, "POST", TOKEN, { model: "qwen3:8b" });
    expect(response.status).toBe(200);
    const view = RuntimeViewSchema.parse(await response.json());
    expect(view.ollama.pull).toMatchObject({ model: "qwen3:8b", step: "downloading" });

    const again = await api(PULL, "POST", TOKEN, { model: "llama3.2:3b" });
    expect([again.status, await again.json()]).toEqual([409, { error: "pull_in_progress" }]);

    const cancelled = RuntimeViewSchema.parse(await (await api(PULL, "DELETE")).json());
    expect(cancelled.ollama.pull).toBeNull();
  });

  test("a model name that isn't one is refused before reaching Ollama", async () => {
    for (const body of [{ model: "../../etc" }, { model: "a b" }, {}, { model: "a", x: 1 }]) {
      const response = await api(PULL, "POST", TOKEN, body);
      expect([response.status, await response.json()]).toEqual([400, { error: "body_invalid" }]);
    }
    expect(pull).toBeNull();
  });
});
