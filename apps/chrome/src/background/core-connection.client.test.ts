import { describe, expect, test } from "bun:test";
import { handshake, settings, setup, until } from "./core-connection.fixture";

describe("CoreConnection", () => {
  test("reconnects with growing delays and resets after ready", async () => {
    const { connection, statuses, timers, sockets, last } = setup();
    connection.configure(settings);
    last().onclose?.();
    timers[0]?.run();
    last().onclose?.();
    expect(timers.map((t) => t.ms)).toEqual([500, 1000]);
    expect(statuses).toEqual(["unreachable"]);
    timers[1]?.run();
    await handshake(last(), connection);
    last().onclose?.();
    expect(timers.filter((t) => t.ms !== 20_000)[2]?.ms).toBe(500);
    expect(statuses).toEqual(["unreachable", "ready", "connecting"]);
    expect(sockets).toHaveLength(3);
  });

  test("stops retrying after auth_failed until settings change", async () => {
    const { connection, statuses, timers, sockets, last } = setup();
    connection.configure(settings);
    last().receive({ type: "error", code: "auth_failed" });
    await until(() => connection.status === "auth_failed");
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

  test("pings every 20 s while ready, so the MV3 worker isn't stopped mid-check", async () => {
    const { connection, timers, last } = setup();
    connection.configure(settings);
    last().onopen?.();
    expect(timers).toHaveLength(0);
    await handshake(last(), connection);
    const pings = () => last().sent.filter((m) => (m as { type: string }).type === "ping");
    const keepalive = () => timers.filter((t) => t.ms === 20_000 && !t.cancelled);
    expect(keepalive()).toHaveLength(1);
    keepalive()[0]?.run();
    keepalive().at(-1)?.run();
    expect(pings()).toHaveLength(2);
    expect(keepalive().at(-1)?.ms).toBe(20_000);
  });

  test("stops pinging when the socket closes and starts again after a reconnect", async () => {
    const { connection, timers, last } = setup();
    connection.configure(settings);
    await handshake(last(), connection);
    const first = last();
    first.onclose?.();
    const keepalive = () => timers.filter((t) => t.ms === 20_000 && !t.cancelled);
    expect(keepalive()).toHaveLength(0);
    timers.find((t) => t.ms !== 20_000)?.run();
    await handshake(last(), connection);
    expect(keepalive()).toHaveLength(1);
    connection.configure({ ...settings, port: 8000 });
    expect(keepalive()).toHaveLength(0);
    expect(first.sent.map((m) => (m as { type: string }).type)).toEqual(["proof"]);
  });
});
