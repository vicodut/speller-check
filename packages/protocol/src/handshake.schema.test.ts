import { describe, expect, test } from "bun:test";
import {
  ClientMessage,
  CoreMessage,
  HandshakeNonce,
  HandshakeProof,
  handshakeInput,
} from "./index";

const NONCE_A = "a".repeat(64);
const NONCE_B = "b".repeat(64);

describe("handshake schemas", () => {
  test("nonces and proofs are 64 lowercase hex characters", () => {
    expect(HandshakeNonce.safeParse(NONCE_A).success).toBe(true);
    expect(HandshakeProof.safeParse("0123456789abcdef".repeat(4)).success).toBe(true);
    for (const bad of ["", "a".repeat(63), "a".repeat(65), "A".repeat(64), "g".repeat(64)]) {
      expect(HandshakeNonce.safeParse(bad).success).toBe(false);
      expect(HandshakeProof.safeParse(bad).success).toBe(false);
    }
  });

  test("the signed input names the role, so a core proof never passes as a client proof", () => {
    expect(handshakeInput("client", NONCE_A, NONCE_B)).toBe(
      `gc-handshake-v1|client|${NONCE_A}|${NONCE_B}`,
    );
    expect(handshakeInput("core", NONCE_A, NONCE_B)).not.toBe(
      handshakeInput("client", NONCE_A, NONCE_B),
    );
  });

  test("challenge goes core -> client, proof client -> core", () => {
    const challenge = { type: "challenge", nonce: NONCE_A };
    const proof = { type: "proof", nonce: NONCE_B, proof: NONCE_A };
    expect(CoreMessage.parse(challenge)).toEqual(challenge as CoreMessage);
    expect(ClientMessage.parse(proof)).toEqual(proof as ClientMessage);
    expect(CoreMessage.safeParse({ type: "challenge", nonce: "short" }).success).toBe(false);
    expect(ClientMessage.safeParse({ ...proof, proof: "zz" }).success).toBe(false);
    expect(ClientMessage.safeParse({ type: "proof", nonce: NONCE_B }).success).toBe(false);
  });

  test("ready carries the core's proof, and refuses a malformed one", () => {
    const ready = { type: "ready", proof: NONCE_B };
    expect(CoreMessage.parse(ready)).toEqual(ready as CoreMessage);
    expect(CoreMessage.safeParse({ type: "ready", proof: "nope" }).success).toBe(false);
  });
});
