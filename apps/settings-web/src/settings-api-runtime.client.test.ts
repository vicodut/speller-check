import { afterAll, describe, expect, test } from "bun:test";
import type { RuntimeView } from "@gc/protocol";
import { cancelPull, pullModel } from "./settings-api.client";

const runtime: RuntimeView = {
  ollama: {
    state: "running",
    version: "0.40.13",
    models: [],
    inUse: true,
    startedByApp: false,
    pull: { model: "smollm2:135m", step: "starting", completed: 0, total: 0, error: null },
  },
};
const seen: string[] = [];

/** Answers like the core's pull routes. */
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: async (request) => {
    const body = request.method === "POST" ? await request.text() : "-";
    seen.push(`${request.method} ${new URL(request.url).pathname} ${body}`);
    if (body.includes("busy")) return Response.json({ error: "pull_in_progress" }, { status: 409 });
    return Response.json(runtime);
  },
});
const base = `http://127.0.0.1:${server.port}`;
afterAll(() => server.stop(true));

describe("pull calls", () => {
  test("pull posts the model, cancel deletes; both answer the runtime view", async () => {
    expect(await pullModel("good", "smollm2:135m", base)).toEqual({ ok: true, value: runtime });
    expect(await cancelPull("good", base)).toEqual({ ok: true, value: runtime });
    expect(seen).toEqual([
      'POST /api/runtime/ollama/pull {"model":"smollm2:135m"}',
      "DELETE /api/runtime/ollama/pull -",
    ]);
  });

  test("returns the core's error code", async () => {
    expect(await pullModel("good", "busy", base)).toEqual({
      ok: false,
      error: "pull_in_progress",
    });
  });
});
