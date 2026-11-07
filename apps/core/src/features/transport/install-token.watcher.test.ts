import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InstallTokenRepository } from "./install-token.repository";
import { InstallTokenWatcher } from "./install-token.watcher";

const dir = mkdtempSync(join(tmpdir(), "gc-token-watch-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const started = async (name: string) => {
  const path = join(dir, name);
  const repo = new InstallTokenRepository(path);
  const start = await repo.loadOrCreate();
  if (!start.ok) throw new Error("expected a token");
  return { path, repo, token: start.value, watcher: new InstallTokenWatcher(path, start.value) };
};

describe("InstallTokenWatcher", () => {
  test("serves the token it started with while the file is unchanged", async () => {
    const { token, watcher } = await started("steady");
    expect(watcher.current()).toBe(token);
    expect(watcher.current()).toBe(token);
  });

  test("picks up a rotated token without a restart", async () => {
    const { repo, token, watcher } = await started("rotating");
    const rotated = await repo.rotate();
    if (!rotated.ok) throw new Error("expected a rotated token");
    expect(rotated.value).not.toBe(token);
    expect(watcher.current()).toBe(rotated.value);
  });

  test("fails closed (null) when the file becomes invalid or disappears", async () => {
    const { path, watcher } = await started("broken");
    writeFileSync(path, "not a token");
    expect(watcher.current()).toBeNull();
    rmSync(path);
    expect(watcher.current()).toBeNull();
  });
});
