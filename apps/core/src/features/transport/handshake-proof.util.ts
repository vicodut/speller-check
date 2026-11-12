import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { HandshakeProof, type HandshakeRole, handshakeInput } from "@gc/protocol";

const NONCE_BYTES = 32;

/** A fresh nonce for one connection: 32 random bytes, lowercase hex. */
export const newNonce = (): string => randomBytes(NONCE_BYTES).toString("hex");

/** HMAC-SHA256 keyed with the install token over the role and both nonces, lowercase hex. */
export const signProof = (
  token: string,
  role: HandshakeRole,
  coreNonce: string,
  clientNonce: string,
): string =>
  createHmac("sha256", token)
    .update(handshakeInput(role, coreNonce, clientNonce))
    .digest("hex");

/**
 * Whether `proof` is `role`'s proof over these nonces under `token`, compared in constant time.
 * No token (missing or unreadable file) and a malformed proof verify nothing; never throws.
 */
export const verifyProof = (
  token: string | null,
  role: HandshakeRole,
  coreNonce: string,
  clientNonce: string,
  proof: string,
): boolean => {
  if (!token || !HandshakeProof.safeParse(proof).success) return false;
  const expected = Buffer.from(signProof(token, role, coreNonce, clientNonce), "hex");
  const given = Buffer.from(proof, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
};
