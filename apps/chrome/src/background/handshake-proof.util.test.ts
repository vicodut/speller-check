import { describe, expect, test } from "bun:test";
import { HandshakeNonce } from "@gc/protocol";
import { newNonce, signProof, verifyProof } from "./handshake-proof.util";

const TOKEN = "t".repeat(43);
const CORE_NONCE = "a".repeat(64);
const CLIENT_NONCE = "b".repeat(64);
/** Same known-answer vectors as the core's tests (computed with `openssl dgst -hmac`). */
const CLIENT_PROOF = "5ae107aaa671326d07469df85d9c043d34fecbdb349ee10476e16059e62a0ad6";
const CORE_PROOF = "1234670d212f5e3128399eb9aa76ee0d8127bccf30ed98cbfaa4a71ff4ca76cf";

describe("handshake proofs (WebCrypto)", () => {
  test("signs exactly like the core", async () => {
    expect(await signProof(TOKEN, "client", CORE_NONCE, CLIENT_NONCE)).toBe(CLIENT_PROOF);
    expect(await signProof(TOKEN, "core", CORE_NONCE, CLIENT_NONCE)).toBe(CORE_PROOF);
  });

  test("accepts the genuine core's proof", async () => {
    expect(await verifyProof(TOKEN, "core", CORE_NONCE, CLIENT_NONCE, CORE_PROOF)).toBe(true);
  });

  test("rejects another token, another nonce, or our own proof reflected back", async () => {
    const other = await signProof("u".repeat(43), "core", CORE_NONCE, CLIENT_NONCE);
    expect(await verifyProof(TOKEN, "core", CORE_NONCE, CLIENT_NONCE, other)).toBe(false);
    const fresh = "c".repeat(64);
    expect(await verifyProof(TOKEN, "core", CORE_NONCE, fresh, CORE_PROOF)).toBe(false);
    expect(await verifyProof(TOKEN, "core", CORE_NONCE, CLIENT_NONCE, CLIENT_PROOF)).toBe(false);
  });

  test("rejects malformed proofs without throwing", async () => {
    for (const bad of ["", "zz", CORE_PROOF.toUpperCase(), `${CORE_PROOF}00`, "0".repeat(63)]) {
      expect(await verifyProof(TOKEN, "core", CORE_NONCE, CLIENT_NONCE, bad)).toBe(false);
    }
  });

  test("makes a fresh, well-formed nonce every time", () => {
    const a = newNonce();
    expect(HandshakeNonce.safeParse(a).success).toBe(true);
    expect(newNonce()).not.toBe(a);
  });
});
