import { describe, expect, test } from "bun:test";
import type { ProofMessage } from "@gc/protocol";
import {
  CORE_NONCE,
  challenge,
  handshake,
  readyFor,
  settings,
  setup,
  until,
} from "./core-connection.fixture";
import { signProof } from "./handshake-proof.util";

describe("CoreConnection handshake", () => {
  test("answers the challenge with a proof, never the token, and becomes ready", async () => {
    const { connection, statuses, messages, last } = setup();
    connection.configure(settings);
    expect(last().url).toBe("ws://127.0.0.1:7341");
    last().onopen?.();
    expect(last().sent).toEqual([]);
    const proof = await challenge(last());
    expect(proof).toEqual({ type: "proof", nonce: expect.any(String), proof: expect.any(String) });
    expect(proof.proof).toBe(await signProof("tok", "client", CORE_NONCE, proof.nonce));
    expect(JSON.stringify(last().sent)).not.toContain('"tok"');
    expect(connection.send({ type: "field.closed", fieldId: "p1/f1" })).toBe(false);
    const ready = await readyFor(proof);
    last().receive(ready);
    await until(() => connection.status === "ready");
    expect(statuses).toEqual(["ready"]);
    expect(messages).toEqual([ready]);
    expect(connection.send({ type: "field.closed", fieldId: "p1/f1" })).toBe(true);
  });

  test.each([
    ["a ready without a proof", async () => ({ type: "ready" })],
    ["a proof made with another token", (p: ProofMessage) => readyFor(p, "other")],
    ["its own proof reflected back", async (p: ProofMessage) => ({ ...p, type: "ready" })],
  ])("drops a core that sends %s, sends nothing and stops retrying", async (_name, makeReady) => {
    const { connection, statuses, messages, timers, last } = setup();
    connection.configure(settings);
    const proof = await challenge(last());
    last().receive(await makeReady(proof));
    await until(() => connection.status === "unverified");
    expect(last().closed).toBe(true);
    last().onclose?.();
    expect(statuses).toEqual(["unverified"]);
    expect(messages).toEqual([]);
    expect(timers).toHaveLength(0);
    expect(connection.send({ type: "field.closed", fieldId: "p1/f1" })).toBe(false);
    expect(last().sent).toEqual([proof]);
  });

  test("ignores a ready before any challenge, and a second challenge", async () => {
    const { connection, messages, last } = setup();
    connection.configure(settings);
    last().receive({ type: "ready", proof: "0".repeat(64) });
    await until(() => connection.status === "unverified");
    expect(messages).toEqual([]);
    connection.configure(settings);
    await challenge(last());
    last().receive({ type: "challenge", nonce: "b".repeat(64) });
    await Bun.sleep(5);
    expect(last().sent).toHaveLength(1);
  });

  test("drops invalid core messages", async () => {
    const { connection, messages, last } = setup();
    connection.configure(settings);
    const ready = await handshake(last(), connection);
    last().receive({ type: "issues", fieldId: "x" });
    last().onmessage?.({ data: "not json" });
    await Bun.sleep(5);
    expect(messages).toEqual([ready]);
  });
});
