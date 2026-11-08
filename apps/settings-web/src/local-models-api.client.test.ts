import { afterAll, expect, test } from "bun:test";
import type { LocalModelsView } from "@gc/protocol";
import {
  cancelLocalModel,
  deleteLocalModel,
  downloadLocalModel,
  fetchLocalModels,
} from "./local-models-api.client";

const view: LocalModelsView = { memoryBytes: 8, models: [] };
const seen: string[] = [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (request) => {
    const { pathname } = new URL(request.url);
    seen.push(`${request.method} ${pathname}`);
    if (request.method === "DELETE" && !pathname.endsWith("/download")) {
      return Response.json({ error: "model_in_use" }, { status: 409 });
    }
    return Response.json(view);
  },
});
const base = `http://127.0.0.1:${server.port}`;
afterAll(() => server.stop(true));

test("each call hits its route and parses the view", async () => {
  expect((await fetchLocalModels("t", base)).ok).toBe(true);
  expect((await downloadLocalModel("t", "a", base)).ok).toBe(true);
  expect((await cancelLocalModel("t", "a", base)).ok).toBe(true);
  expect(seen).toEqual([
    "GET /api/local-models",
    "POST /api/local-models/a/download",
    "DELETE /api/local-models/a/download",
  ]);
});

test("a refused delete answers the core's code", async () => {
  expect(await deleteLocalModel("t", "a", base)).toEqual({ ok: false, error: "model_in_use" });
});
