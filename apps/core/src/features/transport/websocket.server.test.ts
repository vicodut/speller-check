import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { CheckRequest, CoreMessage } from "@gc/protocol";
import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import { proofFor } from "./handshake-client.fixture";
import type { ServerDeps } from "./server-deps.types";
import { WebSocketServer } from "./websocket.server";

const TOKEN = "s".repeat(43);
const EXTENSION_ORIGIN = `chrome-extension://${"b".repeat(32)}`;
const updates: CheckRequest[] = [];
const terms: string[] = [];
let disposed = 0;

const deps: ServerDeps = {
  settingsView: () => {
    throw new Error("not used by these tests");
  },
  createSession: (publish) => ({
    update: (request) => {
      updates.push(request);
      publish({ type: "issues", fieldId: request.fieldId, version: request.version, issues: [] });
    },
    close: () => undefined,
    dispose: () => disposed++,
  }),
  addDictionaryTerm: async (term) => {
    terms.push(term);
    return ok(undefined);
  },
  createRephraser: () => ({
    request: async () => undefined,
    edited: () => undefined,
    cancel: () => undefined,
    dispose: () => undefined,
  }),
};
const server = new WebSocketServer(
  { port: 0, token: TOKEN, helloTimeoutMs: 200 },
  deps,
  new Logger(() => undefined),
);
let url = "";

beforeAll(() => {
  const started = server.start();
  if (!started.ok) throw new Error("server did not start");
  url = `ws://127.0.0.1:${started.value.port}`;
});
afterAll(() => server.stop());

type Client = {
  ws: WebSocket;
  next(): Promise<CoreMessage>;
  closed: Promise<number>;
};

/** Opens a client that queues every message it receives. */
const connect = (headers: Record<string, string> = {}): Promise<Client> => {
  const ws = new WebSocket(url, { headers });
  const queue: CoreMessage[] = [];
  const waiters: ((m: CoreMessage) => void)[] = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(String(event.data)) as CoreMessage;
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else queue.push(message);
  };
  const closed = new Promise<number>((resolve) => {
    ws.onclose = (event) => resolve(event.code);
  });
  const next = () =>
    new Promise<CoreMessage>((resolve) => {
      const queued = queue.shift();
      if (queued) resolve(queued);
      else waiters.push(resolve);
    });
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve({ ws, next, closed });
    ws.onerror = () => reject(new Error("connection failed"));
  });
};

const send = (client: Client, message: unknown) => client.ws.send(JSON.stringify(message));

describe("WebSocketServer", () => {
  test("binds to 127.0.0.1 on an ephemeral port", () => {
    expect(url).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/);
    expect(url).not.toEndWith(":0");
  });

  test("authenticates, routes text.changed to the session and disposes it on close", async () => {
    const client = await connect({ Origin: EXTENSION_ORIGIN });
    const challenge = await client.next();
    if (challenge.type !== "challenge") throw new Error("expected a challenge first");
    client.ws.send(proofFor(TOKEN, challenge.nonce));
    expect(await client.next()).toMatchObject({ type: "ready", proof: expect.any(String) });
    send(client, { type: "text.changed", fieldId: "f1", version: 3, text: "Hello" });
    expect(await client.next()).toEqual({ type: "issues", fieldId: "f1", version: 3, issues: [] });
    expect(updates.at(-1)).toEqual({ fieldId: "f1", version: 3, text: "Hello" });
    send(client, { type: "dictionary.add", term: "NestJS" });
    send(client, { type: "nope" });
    expect(await client.next()).toEqual({ type: "error", code: "message_invalid" });
    expect(terms).toEqual(["NestJS"]);
    const before = disposed;
    client.ws.close();
    await client.closed;
    await Bun.sleep(20);
    expect(disposed).toBe(before + 1);
  });

  test("rejects a proof made with another token with auth_failed and closes", async () => {
    const client = await connect();
    const challenge = await client.next();
    if (challenge.type !== "challenge") throw new Error("expected a challenge first");
    client.ws.send(proofFor("wrong".repeat(9), challenge.nonce));
    expect(await client.next()).toEqual({ type: "error", code: "auth_failed" });
    expect(await client.closed).toBe(1008);
  });

  test("tells an outdated extension that sends hello to update", async () => {
    const client = await connect({ Origin: EXTENSION_ORIGIN });
    expect((await client.next()).type).toBe("challenge");
    send(client, { type: "hello", token: TOKEN });
    expect(await client.next()).toEqual({ type: "error", code: "update_extension" });
    expect(await client.closed).toBe(1008);
  });

  test("closes a connection that never sends a proof", async () => {
    const client = await connect();
    expect((await client.next()).type).toBe("challenge");
    expect(await client.next()).toEqual({ type: "error", code: "auth_failed" });
    expect(await client.closed).toBe(1008);
  });

  test("refuses to start on a port already in use, and says so", () => {
    const port = Number(url.split(":").at(-1));
    const logs: string[] = [];
    const second = new WebSocketServer(
      { port, token: TOKEN },
      deps,
      new Logger((line) => logs.push(line)),
    );
    const started = second.start();
    expect(started.ok ? undefined : started.error.code).toBe("port_in_use");
    expect(logs.some((line) => line.includes('"port_in_use"'))).toBe(true);
  });

  test("refuses the upgrade from a web page origin", async () => {
    await expect(connect({ Origin: "https://evil.example" })).rejects.toThrow();
    const response = await fetch(url.replace("ws://", "http://"), {
      headers: { Origin: "https://evil.example", Upgrade: "websocket", Connection: "Upgrade" },
    });
    expect(response.status).toBe(403);
  });
});
