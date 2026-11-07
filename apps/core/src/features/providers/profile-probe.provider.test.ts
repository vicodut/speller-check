import { describe, expect, test } from "bun:test";
import { Logger } from "../../shared/logger";
import type { FetchFn } from "./openai-compatible.provider";
import { ProfileProbeProvider } from "./profile-probe.provider";

const setup = (response: Response, savedKey: string | null = null) => {
  const logs: string[] = [];
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url, init });
    return response;
  };
  const probe = new ProfileProbeProvider(
    async () => savedKey,
    new Logger((line) => logs.push(line)),
    fetchFn,
  );
  return { probe, logs, calls };
};

const endpoint = { profileId: "p1", baseUrl: "https://x.ai/v1/" };

describe("ProfileProbeProvider", () => {
  test("a test sends one single-token request with the saved key and effort", async () => {
    const reply = Response.json({ choices: [{ message: { content: null } }] });
    const { probe, calls, logs } = setup(reply, "sk-saved");
    const result = await probe.test({ ...endpoint, model: "m", reasoningEffort: "none" });
    expect(result.ok).toBe(true);
    expect(calls[0]?.url).toBe("https://x.ai/v1/chat/completions");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      model: "m",
      messages: [{ role: "user", content: "ok" }],
      max_tokens: 1,
      reasoning_effort: "none",
    });
    expect(new Headers(calls[0]?.init.headers).get("authorization")).toBe("Bearer sk-saved");
    expect(logs.join()).not.toContain("sk-saved");
  });

  test("failures are logged as codes only, never the endpoint's reply or the key", async () => {
    const reply = Response.json({ error: { message: "secret detail" } }, { status: 401 });
    const { probe, logs } = setup(reply);
    expect(await probe.models({ ...endpoint, apiKey: "sk-typed" })).toMatchObject({
      error: "key_rejected",
    });
    expect(logs).toEqual([
      JSON.stringify({
        level: "error",
        event: "probe.models_failed",
        code: "provider_key_rejected",
      }),
    ]);
  });

  test("a model list that isn't one is a bad response", async () => {
    const { probe } = setup(Response.json({ models: [] }));
    expect(await probe.models(endpoint)).toEqual({ ok: false, error: "bad_response" });
  });
});
