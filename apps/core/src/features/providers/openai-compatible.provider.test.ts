import { describe, expect, test } from "bun:test";
import { Logger } from "../../shared/logger";
import {
  type FetchFn,
  type OpenAiCompatibleConfig,
  OpenAiCompatibleProvider,
} from "./openai-compatible.provider";

type Call = { url: string; init: RequestInit; body: Record<string, unknown> | undefined };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const completion = (content: string) => json({ choices: [{ message: { content } }] });

const setup = (responses: Array<Response | Error>, extra: Partial<OpenAiCompatibleConfig> = {}) => {
  const calls: Call[] = [];
  const logs: string[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, init, body });
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  };
  const config = { baseUrl: "http://127.0.0.1:11434/v1", model: "m", ...extra };
  const provider = new OpenAiCompatibleProvider(config, new Logger((l) => logs.push(l)), fetchFn);
  return { provider, calls, logs };
};

const messages = [{ role: "user", content: "I has went." }] as const;

describe("OpenAiCompatibleProvider.complete", () => {
  test("posts a JSON-mode chat completion and returns the content", async () => {
    const { provider, calls } = setup([completion('{"issues":[]}')]);
    expect(await provider.complete(messages)).toEqual({ ok: true, value: '{"issues":[]}' });
    expect(calls[0]?.url).toBe("http://127.0.0.1:11434/v1/chat/completions");
    expect(calls[0]?.body).toMatchObject({
      model: "m",
      temperature: 0,
      response_format: { type: "json_object" },
    });
  });

  test("sends the bearer token only when an API key is set", async () => {
    const withKey = setup([completion("{}")], { apiKey: "sk-test" });
    await withKey.provider.complete(messages);
    expect(new Headers(withKey.calls[0]?.init.headers).get("authorization")).toBe("Bearer sk-test");

    const withoutKey = setup([completion("{}")]);
    await withoutKey.provider.complete(messages);
    expect(new Headers(withoutKey.calls[0]?.init.headers).has("authorization")).toBe(false);
  });

  test("sends reasoning_effort only when configured", async () => {
    const withEffort = setup([completion("{}")], { reasoningEffort: "none" });
    await withEffort.provider.complete(messages);
    expect(withEffort.calls[0]?.body).toMatchObject({ reasoning_effort: "none" });

    const withoutEffort = setup([completion("{}")]);
    await withoutEffort.provider.complete(messages);
    expect(withoutEffort.calls[0]?.body).not.toHaveProperty("reasoning_effort");
  });

  test("retries without response_format after a 400 and remembers it", async () => {
    const { provider, calls } = setup([json({}, 400), completion("{}"), completion("{}")]);
    expect((await provider.complete(messages)).ok).toBe(true);
    await provider.complete(messages);
    expect(calls.map((c) => "response_format" in (c.body ?? {}))).toEqual([true, false, false]);
  });

  test("maps HTTP errors to provider_http with the status", async () => {
    const { provider } = setup([json({}, 500)]);
    expect(await provider.complete(messages)).toEqual({
      ok: false,
      error: { code: "provider_http", status: 500 },
    });
  });

  test.each([
    ["provider_timeout" as const, new DOMException("timed out", "TimeoutError")],
    ["provider_network" as const, new TypeError("fetch failed")],
  ])("maps thrown errors to %s", async (code, thrown) => {
    const { provider } = setup([thrown]);
    expect(await provider.complete(messages)).toEqual({ ok: false, error: { code } });
  });

  test("rejects a response without choices", async () => {
    const { provider } = setup([json({ choices: [] })]);
    expect(await provider.complete(messages)).toEqual({
      ok: false,
      error: { code: "provider_bad_response" },
    });
  });

  test("never logs message or response content", async () => {
    const { provider, logs } = setup([completion("secret reply")]);
    await provider.complete(messages);
    expect(logs.join("\n")).not.toContain("I has went");
    expect(logs.join("\n")).not.toContain("secret reply");
  });
});

describe("OpenAiCompatibleProvider.listModels / healthcheck", () => {
  test("lists model ids", async () => {
    const { provider, calls } = setup([json({ data: [{ id: "a" }, { id: "b" }] })]);
    expect(await provider.listModels()).toEqual({ ok: true, value: ["a", "b"] });
    expect(calls[0]?.url).toBe("http://127.0.0.1:11434/v1/models");
  });

  test("healthcheck reflects whether /models answers", async () => {
    expect(await setup([json({ data: [] })]).provider.healthcheck()).toBe(true);
    expect(await setup([new TypeError("down")]).provider.healthcheck()).toBe(false);
  });
});
