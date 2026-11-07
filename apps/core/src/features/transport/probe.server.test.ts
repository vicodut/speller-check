import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ModelsResult, ProfilesView, TestResult } from "@gc/protocol";
import { GOOD_KEY, startFakeOpenAi } from "./fake-openai.fixture";
import { startProfilesServer } from "./profiles-server.fixture";

let fake: ReturnType<typeof startFakeOpenAi>;
let ctx: Awaited<ReturnType<typeof startProfilesServer>>;

beforeEach(async () => {
  fake = startFakeOpenAi();
  ctx = await startProfilesServer();
});
afterEach(async () => {
  fake.stop();
  await ctx.stop();
});

const draft = () => ({ profileId: null, baseUrl: fake.baseUrl });
const models = async (body: unknown) =>
  ModelsResult.parse(await (await ctx.api("/api/probe/models", "POST", body)).json());
const testProfile = async (body: unknown) =>
  TestResult.parse(await (await ctx.api("/api/probe/test", "POST", body)).json());

/** Saves a profile on the fake endpoint with the good key; returns its id. */
const saveKeyed = async () => {
  const input = { name: "Fake", baseUrl: fake.baseUrl, model: "qwen-a", reasoningEffort: null };
  const saved = await ctx.api("/api/profiles", "POST", { ...input, apiKey: GOOD_KEY });
  const view = ProfilesView.parse(await saved.json());
  return view.profiles.find((p) => p.name === "Fake")?.id ?? "";
};

describe("POST /api/probe/models", () => {
  test("lists an unsaved draft's models, sorted and deduplicated, with the typed key", async () => {
    expect(await models({ ...draft(), apiKey: GOOD_KEY })).toEqual({
      ok: true,
      models: ["qwen-a", "qwen-b"],
    });
    expect(fake.seen).toEqual([`Bearer ${GOOD_KEY}`]);
  });

  test("uses a saved profile's Keychain key, but never on another host", async () => {
    const id = await saveKeyed();
    expect((await models({ profileId: id, baseUrl: fake.baseUrl })).ok).toBe(true);
    const otherHost = fake.baseUrl.replace("127.0.0.1", "localhost");
    expect(await models({ profileId: id, baseUrl: otherHost })).toEqual({
      ok: false,
      error: "key_rejected",
      status: 401,
    });
    expect(fake.seen).toEqual([`Bearer ${GOOD_KEY}`, null]);
    // null: the form is removing the key, so none is sent.
    expect(await models({ profileId: id, baseUrl: fake.baseUrl, apiKey: null })).toMatchObject({
      error: "key_rejected",
    });
  });

  test("an unreachable endpoint and a bad body are told apart", async () => {
    fake.stop();
    expect(await models({ ...draft(), apiKey: GOOD_KEY })).toEqual({
      ok: false,
      error: "unreachable",
    });
    const bad = await ctx.api("/api/probe/models", "POST", { baseUrl: "ftp://x" });
    expect(bad.status).toBe(400);
    expect((await ctx.api("/api/probe/models")).status).toBe(405);
  });
});

describe("POST /api/probe/test", () => {
  const probe = (model: string, apiKey: string | null = GOOD_KEY) => ({
    ...draft(),
    apiKey,
    model,
    reasoningEffort: "none",
  });

  test("answers ok with the time taken, and never echoes the key", async () => {
    const response = await ctx.api("/api/probe/test", "POST", probe("qwen-a"));
    const text = await response.text();
    expect(text).not.toContain(GOOD_KEY);
    const result = TestResult.parse(JSON.parse(text));
    expect(result.ok && result.ms >= 0).toBe(true);
  });

  test("an unsaved edit of a saved profile tests with its saved key", async () => {
    const id = await saveKeyed();
    const result = await testProfile({ ...probe("qwen-a"), profileId: id, apiKey: undefined });
    expect(result.ok).toBe(true);
  });

  test("reports a rejected key, an unknown model and a timeout", async () => {
    expect(await testProfile(probe("qwen-a", "sk-bad"))).toMatchObject({ error: "key_rejected" });
    expect(await testProfile(probe("nope"))).toEqual({
      ok: false,
      error: "unknown_model",
      status: 404,
    });
    expect(await testProfile(probe("slow"))).toEqual({ ok: false, error: "timeout" });
  });

  test("a test needs a model", async () => {
    expect((await ctx.api("/api/probe/test", "POST", draft())).status).toBe(400);
  });
});
