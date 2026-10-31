import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InstallTokenRepository } from "./install-token.repository";

const dir = mkdtempSync(join(tmpdir(), "gc-token-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("InstallTokenRepository", () => {
  test("creates a 32-byte base64url token with mode 0600, in a new parent dir", async () => {
    const path = join(dir, "nested", "token");
    const result = await new InstallTokenRepository(path).loadOrCreate();
    if (!result.ok) throw new Error("expected a token");
    expect(result.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(result.value, "base64url")).toHaveLength(32);
    expect(readFileSync(path, "utf8")).toBe(result.value);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  test("returns the same token on the next load", async () => {
    const repo = new InstallTokenRepository(join(dir, "stable"));
    const first = await repo.loadOrCreate();
    const second = await repo.loadOrCreate();
    expect(second).toEqual(first);
  });

  test("reads and trims an existing token", async () => {
    const path = join(dir, "existing");
    const token = "a".repeat(43);
    writeFileSync(path, `${token}\n`);
    expect(await new InstallTokenRepository(path).loadOrCreate()).toEqual({
      ok: true,
      value: token,
    });
  });

  test.each([
    ["empty", ""],
    ["blank", "  \n"],
    ["too short", "abc"],
    ["not base64url", `${"a".repeat(40)} +/=`],
  ])("fails with token_read_failed on an %s file", async (name, content) => {
    const path = join(dir, `bad-${name}`);
    writeFileSync(path, content);
    expect(await new InstallTokenRepository(path).loadOrCreate()).toEqual({
      ok: false,
      error: { code: "token_read_failed" },
    });
  });
});
