import { afterAll, describe, expect, test } from "bun:test";
import type { FeatureSettingsView } from "@gc/protocol";
import { fetchSettings } from "./settings-api.client";

const feature: FeatureSettingsView = {
  baseUrl: { value: "http://127.0.0.1:11434/v1", source: "env", envVar: "GC_BASE_URL" },
  model: { value: "qwen3:8b", source: "env", envVar: "GC_MODEL" },
  reasoningEffort: { value: null, source: "unset" },
  apiKey: { set: false, source: "unset" },
};
const view = { check: feature, rephrase: feature };

/** Answers like the core's settings API: the view for the right token, else its error body. */
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (request) => {
    const path = new URL(request.url).pathname;
    if (path === "/broken/api/settings") return Response.json({ check: "nope" });
    if (request.headers.get("authorization") !== "Bearer good")
      return Response.json({ error: "auth_failed" }, { status: 401 });
    return Response.json(view);
  },
});
const base = `http://127.0.0.1:${server.port}`;
afterAll(() => server.stop(true));

describe("fetchSettings", () => {
  test("returns the parsed view and sends the token as a bearer token", async () => {
    expect(await fetchSettings("good", base)).toEqual({ ok: true, value: view });
  });

  test("returns the core's error code", async () => {
    expect(await fetchSettings("bad", base)).toEqual({ ok: false, error: "auth_failed" });
  });

  test("rejects a body that isn't a settings view", async () => {
    expect(await fetchSettings("good", `${base}/broken`)).toEqual({
      ok: false,
      error: "bad_response",
    });
  });

  test("reports an unreachable core", async () => {
    const failing = (async () => {
      throw new TypeError("connection refused");
    }) as unknown as typeof fetch;
    expect(await fetchSettings("good", base, failing)).toEqual({
      ok: false,
      error: "unreachable",
    });
  });
});
