import { describe, expect, test } from "bun:test";
import { HandshakeNonce } from "@gc/protocol";
import { newNonce, signProof, verifyProof } from "./handshake-proof.util";

const TOKEN = "t".repeat(43);
const CORE_NONCE = "a".repeat(64);
const CLIENT_NONCE = "b".repeat(64);
/** Computed with `openssl dgst -sha256 -hmac`; the extension's tests use the same vectors. */
const CLIENT_PROOF = "5ae107aaa671326d07469df85d9c043d34fecbdb349ee10476e16059e62a0ad6";
const CORE_PROOF = "1234670d212f5e3128399eb9aa76ee0d8127bccf30ed98cbfaa4a71ff4ca76cf";

describe("handshake proofs", () => {
  test("signs HMAC-SHA256 over the role and both nonces (known-answer vectors)", () => {
    expect(signProof(TOKEN, "client", CORE_NONCE, CLIENT_NONCE)).toBe(CLIENT_PROOF);
    expect(signProof(TOKEN, "core", CORE_NONCE, CLIENT_NONCE)).toBe(CORE_PROOF);
  });

  test("accepts the correct proof", () => {
    expect(verifyProof(TOKEN, "client", CORE_NONCE, CLIENT_NONCE, CLIENT_PROOF)).toBe(true);
  });

  test("rejects a proof made with another token, or with no token on file", () => {
    const other = signProof("u".repeat(43), "client", CORE_NONCE, CLIENT_NONCE);
    expect(verifyProof(TOKEN, "client", CORE_NONCE, CLIENT_NONCE, other)).toBe(false);
    expect(verifyProof(null, "client", CORE_NONCE, CLIENT_NONCE, CLIENT_PROOF)).toBe(false);
    expect(verifyProof("", "client", CORE_NONCE, CLIENT_NONCE, CLIENT_PROOF)).toBe(false);
  });

  test("rejects a proof replayed against another nonce", () => {
    const fresh = "c".repeat(64);
    expect(verifyProof(TOKEN, "client", fresh, CLIENT_NONCE, CLIENT_PROOF)).toBe(false);
    expect(verifyProof(TOKEN, "client", CORE_NONCE, fresh, CLIENT_PROOF)).toBe(false);
  });

  test("rejects the other side's proof reflected back", () => {
    expect(verifyProof(TOKEN, "client", CORE_NONCE, CLIENT_NONCE, CORE_PROOF)).toBe(false);
    expect(verifyProof(TOKEN, "core", CORE_NONCE, CLIENT_NONCE, CLIENT_PROOF)).toBe(false);
  });

  test("rejects malformed proofs without throwing", () => {
    for (const bad of ["", "zz", CLIENT_PROOF.toUpperCase(), `${CLIENT_PROOF}00`, "0".repeat(63)]) {
      expect(verifyProof(TOKEN, "client", CORE_NONCE, CLIENT_NONCE, bad)).toBe(false);
    }
  });

  test("makes a fresh, well-formed nonce every time", () => {
    const a = newNonce();
    expect(HandshakeNonce.safeParse(a).success).toBe(true);
    expect(newNonce()).not.toBe(a);
  });
});
