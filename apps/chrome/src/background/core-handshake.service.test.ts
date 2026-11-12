import { describe, expect, test } from "bun:test";
import { CoreHandshake } from "./core-handshake.service";
import { signProof } from "./handshake-proof.util";

const TOKEN = "t".repeat(43);
const CORE_NONCE = "a".repeat(64);
const challenge = { type: "challenge", nonce: CORE_NONCE } as const;

describe("CoreHandshake", () => {
  test("answers the challenge with a fresh nonce and a proof, never the token", async () => {
    const answer = await new CoreHandshake(TOKEN).answer(challenge);
    if (!answer) throw new Error("expected a proof");
    expect(answer.type).toBe("proof");
    expect(answer.proof).toBe(await signProof(TOKEN, "client", CORE_NONCE, answer.nonce));
    expect(JSON.stringify(answer)).not.toContain(TOKEN);
    const other = await new CoreHandshake(TOKEN).answer(challenge);
    expect(other?.nonce).not.toBe(answer.nonce);
  });

  test("answers only the first challenge", async () => {
    const handshake = new CoreHandshake(TOKEN);
    await handshake.answer(challenge);
    expect(await handshake.answer({ type: "challenge", nonce: "b".repeat(64) })).toBeUndefined();
  });

  test("verifies the genuine core's proof over both nonces", async () => {
    const handshake = new CoreHandshake(TOKEN);
    const answer = await handshake.answer(challenge);
    const proof = await signProof(TOKEN, "core", CORE_NONCE, answer?.nonce ?? "");
    expect(await handshake.verify({ type: "ready", proof })).toBe(true);
  });

  test("refuses a ready before the challenge, without a proof, or with a forged one", async () => {
    expect(await new CoreHandshake(TOKEN).verify({ type: "ready", proof: "0".repeat(64) })).toBe(
      false,
    );
    const handshake = new CoreHandshake(TOKEN);
    const answer = await handshake.answer(challenge);
    expect(await handshake.verify({ type: "ready" })).toBe(false);
    const nonce = answer?.nonce ?? "";
    const forged = await signProof("u".repeat(43), "core", CORE_NONCE, nonce);
    expect(await handshake.verify({ type: "ready", proof: forged })).toBe(false);
    // Our own proof reflected back is not the core's.
    expect(await handshake.verify({ type: "ready", proof: answer?.proof })).toBe(false);
  });
});
