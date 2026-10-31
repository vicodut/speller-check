import { describe, expect, test } from "bun:test";
import type { CoreMessage } from "@gc/protocol";
import type { ConnectionStatus } from "../shared/port-messages";
import { CoreConnection, type CoreSocket } from "./core-connection.client";

class FakeSocket implements CoreSocket {
  readonly sent: unknown[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly url: string) {}
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(): void {
    this.closed = true;
  }
  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const setup = () => {
  const sockets: FakeSocket[] = [];
  const statuses: ConnectionStatus[] = [];
  const messages: CoreMessage[] = [];
  const timers: { run: () => void; ms: number }[] = [];
  const connection = new CoreConnection({
    onMessage: (message) => messages.push(message),
    onStatus: (status) => statuses.push(status),
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    schedule: (run, ms) => {
      timers.push({ run, ms });
      return () => {};
    },
  });
  const last = (): FakeSocket => sockets[sockets.length - 1] as FakeSocket;
  return { connection, sockets, statuses, messages, timers, last };
};

const settings = { token: "tok", port: 7341, blockedSites: [] };

describe("CoreConnection", () => {
  test("sends hello on open and becomes ready", () => {
    const { connection, statuses, messages, last } = setup();
    connection.configure(settings);
    expect(last().url).toBe("ws://127.0.0.1:7341");
    last().onopen?.();
    expect(last().sent).toEqual([{ type: "hello", token: "tok" }]);
    expect(connection.send({ type: "field.closed", fieldId: "p1/f1" })).toBe(false);
    last().receive({ type: "ready" });
    expect(statuses).toEqual(["ready"]);
    expect(messages).toEqual([{ type: "ready" }]);
    expect(connection.send({ type: "field.closed", fieldId: "p1/f1" })).toBe(true);
  });

  test("drops invalid core messages", () => {
    const { connection, messages, last } = setup();
    connection.configure(settings);
    last().receive({ type: "ready" });
    last().receive({ type: "issues", fieldId: "x" });
    last().onmessage?.({ data: "not json" });
    expect(messages).toEqual([{ type: "ready" }]);
  });

  test("reconnects with growing delays and resets after ready", () => {
    const { connection, statuses, timers, sockets, last } = setup();
    connection.configure(settings);
    last().onclose?.();
    timers[0]?.run();
    last().onclose?.();
    expect(timers.map((t) => t.ms)).toEqual([500, 1000]);
    expect(statuses).toEqual(["unreachable"]);
    timers[1]?.run();
    last().receive({ type: "ready" });
    last().onclose?.();
    expect(timers[2]?.ms).toBe(500);
    expect(statuses).toEqual(["unreachable", "ready", "connecting"]);
    expect(sockets).toHaveLength(3);
  });

  test("stops retrying after auth_failed until settings change", () => {
    const { connection, statuses, timers, sockets, last } = setup();
    connection.configure(settings);
    last().receive({ type: "error", code: "auth_failed" });
    expect(last().closed).toBe(true);
    last().onclose?.();
    expect(timers).toHaveLength(0);
    expect(statuses).toEqual(["auth_failed"]);
    connection.configure({ ...settings, token: "new", port: 8000 });
    expect(sockets).toHaveLength(2);
    expect(last().url).toBe("ws://127.0.0.1:8000");
    expect(statuses).toEqual(["auth_failed", "connecting"]);
  });

  test("does not connect without a token", () => {
    const { connection, sockets } = setup();
    connection.configure({ ...settings, token: "" });
    expect(sockets).toHaveLength(0);
    expect(connection.status).toBe("auth_failed");
  });
});
