import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import { SettingsPageFiles } from "./settings-page-files.repository";
import { WebSocketServer } from "./websocket.server";

let dir = "";
let base = "";
let server: WebSocketServer;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "gc-settings-page-"));
  await writeFile(join(dir, "index.html"), "<!doctype html><title>settings</title>");
  await writeFile(join(dir, "app.js"), "console.log(1)");
  await writeFile(join(dir, "app.css"), "body{}");
  await writeFile(join(dir, "secret.txt"), "not part of the page");
  server = new WebSocketServer(
    { port: 0, token: "p".repeat(43) },
    {
      settingsView: () => {
        throw new Error("not used");
      },
      settingsPage: new SettingsPageFiles(dir),
      createSession: () => ({ update: () => {}, close: () => {}, dispose: () => {} }),
      addDictionaryTerm: async () => ok(undefined),
      createRephraser: () => ({
        request: async () => {},
        edited: () => {},
        cancel: () => {},
        dispose: () => {},
      }),
    },
    new Logger(() => {}),
  );
  const started = server.start();
  if (!started.ok) throw new Error("server did not start");
  base = `http://127.0.0.1:${started.value.port}`;
});

afterAll(async () => {
  server.stop();
  await rm(dir, { recursive: true, force: true });
});

describe("the settings page", () => {
  test("is served without a token, with a strict CSP and no framing", async () => {
    const response = await fetch(`${base}/settings`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("<title>settings</title>");
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  test("serves its script and stylesheet with their types", async () => {
    const js = await fetch(`${base}/settings/app.js`);
    expect(js.headers.get("content-type")).toContain("text/javascript");
    const css = await fetch(`${base}/settings/app.css`);
    expect(css.headers.get("content-type")).toContain("text/css");
  });

  test("serves nothing else from the folder, including traversal attempts", async () => {
    expect((await fetch(`${base}/settings/secret.txt`)).status).toBe(404);
    expect((await fetch(`${base}/settings/..%2Fsecret.txt`)).status).toBe(404);
    expect((await fetch(`${base}/settings/../package.json`)).status).not.toBe(200);
  });

  test("is refused under another Host name", async () => {
    const response = await fetch(`${base}/settings`, { headers: { host: "evil.example" } });
    expect(response.status).toBe(403);
  });

  test("only answers GET", async () => {
    expect((await fetch(`${base}/settings`, { method: "POST" })).status).toBe(405);
  });
});

describe("a page that wasn't built", () => {
  test("answers 404 instead of failing", async () => {
    const files = new SettingsPageFiles(join(dir, "missing"));
    expect(await files.read("/settings")).toBeNull();
  });
});
