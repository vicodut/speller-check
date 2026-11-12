import { z } from "zod";

/**
 * Mutual proof of the install token, without sending it. The core opens with `challenge`
 * (its nonce); the client answers `proof` (its own nonce, and its proof over both); the core
 * answers `ready` with its proof over both. Each proof is HMAC-SHA256 keyed with the token
 * (UTF-8) over `handshakeInput(role, coreNonce, clientNonce)`, in lowercase hex.
 */

/** 32 random bytes, lowercase hex. Fresh for every connection, on both sides. */
export const HandshakeNonce = z.string().regex(/^[0-9a-f]{64}$/);
export type HandshakeNonce = z.infer<typeof HandshakeNonce>;

/** HMAC-SHA256, lowercase hex. */
export const HandshakeProof = z.string().regex(/^[0-9a-f]{64}$/);
export type HandshakeProof = z.infer<typeof HandshakeProof>;

/** Who signs: the role is in the input, so one side's proof never passes for the other's. */
export type HandshakeRole = "client" | "core";

/** The bytes (as UTF-8) a proof signs. Versioned, so a format change can't verify by accident. */
export const handshakeInput = (
  role: HandshakeRole,
  coreNonce: string,
  clientNonce: string,
): string => `gc-handshake-v1|${role}|${coreNonce}|${clientNonce}`;
