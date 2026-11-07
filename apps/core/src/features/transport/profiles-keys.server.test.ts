import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ProfilesView } from "@gc/protocol";
import { cloud, startProfilesServer } from "./profiles-server.fixture";

describe("API keys over HTTP", () => {
  test("a key goes to the Keychain and never comes back in a response or the file", async () => {
    const ctx = await startProfilesServer();
    const response = await ctx.api("/api/profiles", "POST", {
      ...cloud,
      name: "Keyed",
      apiKey: "sk-secret",
    });
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).not.toContain("sk-secret");
    const id = ProfilesView.parse(JSON.parse(text)).profiles.find((p) => p.name === "Keyed");
    expect(id?.hasKey).toBe(true);
    expect(ctx.keys.items.get(id?.id ?? "")).toBe("sk-secret");
    expect(await readFile(join(ctx.dir, "settings.json"), "utf8")).not.toContain("sk-secret");
    expect((await ctx.api(`/api/profiles/${id?.id}`, "DELETE")).status).toBe(200);
    expect(ctx.keys.items.size).toBe(0);
    await ctx.stop();
  });
});
