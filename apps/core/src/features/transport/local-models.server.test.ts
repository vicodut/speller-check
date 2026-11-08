import { afterAll, describe, expect, test } from "bun:test";
import { type LocalModelsView, LocalModelsView as LocalModelsViewSchema } from "@gc/protocol";
import { appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok } from "../../shared/result";
import { WebSocketServer } from "./websocket.server";

const TOKEN = "m".repeat(43);
let view: LocalModelsView = {
  memoryBytes: 8_000,
  models: [
    {
      id: "a",
      kind: "model",
      name: "A",
      sizeBytes: 10,
      ramBytes: 9_000,
      fixtureScore: null,
      state: "absent",
      completed: 0,
      error: null,
      ramWarning: true,
      inUse: false,
    },
  ],
};
const calls: string[] = [];
const localModels = {
  view: async () => view,
  start: (id: string) => {
    calls.push(`start ${id}`);
    if (id !== "a") return err(appError("model_not_found"));
    view = { ...view, models: view.models.map((m) => ({ ...m, state: "downloading" as const })) };
    return ok(undefined);
  },
  cancel: () => {
    calls.push("cancel");
  },
  remove: async (id: string) => {
    calls.push(`remove ${id}`);
    return id === "a" ? err(appError("model_in_use")) : err(appError("model_not_found"));
  },
};

const server = new WebSocketServer(
  { port: 0, token: TOKEN },
  {
    settingsView: () => {
      throw new Error("not used");
    },
    localModels,
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

describe("local models over HTTP", () => {
  test("GET /api/local-models answers the view, behind the token", async () => {
    expect((await api("/api/local-models", "GET", "x".repeat(43))).status).toBe(401);
    const body = LocalModelsViewSchema.parse(await (await api("/api/local-models")).json());
    expect(body.models[0]?.ramWarning).toBe(true);
    expect((await api("/api/local-models", "POST")).status).toBe(405);
  });

  test("POST .../<id>/download starts and answers the view; unknown id is 404", async () => {
    const started = await api("/api/local-models/a/download", "POST");
    expect(started.status).toBe(200);
    expect(LocalModelsViewSchema.parse(await started.json()).models[0]?.state).toBe("downloading");
    expect((await api("/api/local-models/zzz/download", "POST")).status).toBe(404);
  });

  test("DELETE .../<id>/download cancels", async () => {
    expect((await api("/api/local-models/a/download", "DELETE")).status).toBe(200);
    expect(calls).toContain("cancel");
  });

  test("DELETE .../<id> answers 409 while a profile uses the model", async () => {
    const res = await api("/api/local-models/a", "DELETE");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "model_in_use" });
    expect((await api("/api/local-models/b", "DELETE")).status).toBe(404);
  });
});
