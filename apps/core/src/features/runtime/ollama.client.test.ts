import { afterAll, describe, expect, test } from "bun:test";
import { OllamaClient } from "./ollama.client";
import type { PullLine } from "./pull-progress.util";

const encoder = new TextEncoder();

/** Streams NDJSON lines one by one; never closes when `hang` is set (a pull that runs on). */
const ndjson = (lines: unknown[], hang = false) =>
  new Response(
    new ReadableStream({
      async start(controller) {
        for (const line of lines) {
          controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
          await Bun.sleep(1);
        }
        if (!hang) controller.close();
      },
    }),
    { headers: { "content-type": "application/x-ndjson" } },
  );

const LAYER = { status: "pulling a", digest: "sha256:a", total: 10, completed: 10 };

/** Shaped like Ollama's /api/version, /api/tags and /api/pull. */
const pull = async (request: Request): Promise<Response> => {
  const { model, stream } = (await request.json()) as { model: string; stream: boolean };
  if (!stream) return Response.json({ error: "test expects a stream" }, { status: 400 });
  if (model === "missing:1b")
    return ndjson([
      { status: "pulling manifest" },
      { error: "pull model manifest: file does not exist" },
    ]);
  if (model === "broken:1b") return Response.json({ error: "disk full" }, { status: 500 });
  if (model === "slow:1b") return ndjson([{ status: "pulling manifest" }], true);
  return ndjson([{ status: "pulling manifest" }, LAYER, { status: "success" }]);
};

const ollama = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (request) => {
    const path = new URL(request.url).pathname;
    if (path === "/api/version") return Response.json({ version: "0.40.13" });
    if (path === "/api/tags")
      return Response.json({ models: [{ name: "qwen3:8b", size: 1 }, { name: "llama3.2:3b" }] });
    if (path === "/api/pull" && request.method === "POST") return pull(request);
    return new Response("not found", { status: 404 });
  },
});
afterAll(() => ollama.stop(true));

const client = new OllamaClient(`http://127.0.0.1:${ollama.port}`);
const pullLines = async (model: string, signal = new AbortController().signal) => {
  const lines: PullLine[] = [];
  const result = await client.pull(model, signal, (line) => lines.push(line));
  return { result, lines };
};

describe("OllamaClient", () => {
  test("reads the version and the pulled models", async () => {
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

  test("pulls a model, handing over each status line as it streams", async () => {
    const { result, lines } = await pullLines("smollm2:135m");
    expect(result.ok).toBe(true);
    expect(lines).toEqual([{ status: "pulling manifest" }, LAYER, { status: "success" }]);
  });

  test("maps Ollama's errors to codes, in the stream or as an HTTP error", async () => {
    const missing = await pullLines("missing:1b");
    expect(missing.result).toEqual({ ok: false, error: { code: "ollama_model_not_found" } });
    const broken = await pullLines("broken:1b");
    expect(broken.result).toEqual({ ok: false, error: { code: "ollama_pull_failed" } });
  });

  test("an abort cancels a running pull; no Ollama is unreachable", async () => {
    const abort = new AbortController();
    const running = pullLines("slow:1b", abort.signal);
    await Bun.sleep(20);
    abort.abort();
    expect((await running).result).toEqual({
      ok: false,
      error: { code: "ollama_pull_cancelled" },
    });
    const closed = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
    const origin = `http://127.0.0.1:${closed.port}`;
    closed.stop(true);
    const result = await new OllamaClient(origin).pull("a", new AbortController().signal, () => {});
    expect(result).toEqual({ ok: false, error: { code: "ollama_unreachable" } });
  });
});
