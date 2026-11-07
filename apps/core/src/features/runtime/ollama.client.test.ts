import { afterAll, describe, expect, test } from "bun:test";
import { OllamaClient } from "./ollama.client";

/** Shaped like Ollama's /api/version and /api/tags. */
const ollama = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (request) => {
    const path = new URL(request.url).pathname;
    if (path === "/api/version") return Response.json({ version: "0.40.13" });
    if (path === "/api/tags")
      return Response.json({ models: [{ name: "qwen3:8b", size: 1 }, { name: "llama3.2:3b" }] });
    return new Response("not found", { status: 404 });
  },
});
afterAll(() => ollama.stop(true));

describe("OllamaClient", () => {
  test("reads the version and the pulled models", async () => {
    const client = new OllamaClient(`http://127.0.0.1:${ollama.port}`);
    expect(await client.status()).toEqual({
      version: "0.40.13",
      models: ["qwen3:8b", "llama3.2:3b"],
    });
  });

  test("is null when nothing answers", async () => {
    const closed = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
    const origin = `http://127.0.0.1:${closed.port}`;
    closed.stop(true);
    expect(await new OllamaClient(origin).status()).toBeNull();
  });
});
