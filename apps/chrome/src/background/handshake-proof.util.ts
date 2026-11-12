import { HandshakeProof, type HandshakeRole, handshakeInput } from "@gc/protocol";

const NONCE_BYTES = 32;
const HMAC = { name: "HMAC", hash: "SHA-256" } as const;
const utf8 = new TextEncoder();

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** Lowercase hex only (validated by the caller), so every pair parses. */
const fromHex = (hex: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));

const hmacKey = (token: string, usage: "sign" | "verify"): Promise<CryptoKey> =>
  crypto.subtle.importKey("raw", utf8.encode(token), HMAC, false, [usage]);

/** A fresh nonce for one connection: 32 random bytes, lowercase hex. */
export const newNonce = (): string => toHex(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));

/** HMAC-SHA256 keyed with the install token over the role and both nonces, lowercase hex. */
export const signProof = async (
  token: string,
  role: HandshakeRole,
  coreNonce: string,
  clientNonce: string,
): Promise<string> => {
  const input = utf8.encode(handshakeInput(role, coreNonce, clientNonce));
  const signature = await crypto.subtle.sign(HMAC, await hmacKey(token, "sign"), input);
  return toHex(new Uint8Array(signature));
};

/**
 * Whether `proof` is `role`'s proof over these nonces under `token`. WebCrypto's verify does
 * the comparison (constant time). A malformed proof verifies nothing; never throws.
 */
export const verifyProof = async (
  token: string,
  role: HandshakeRole,
  coreNonce: string,
  clientNonce: string,
  proof: string,
): Promise<boolean> => {
  if (!token || !HandshakeProof.safeParse(proof).success) return false;
  const input = utf8.encode(handshakeInput(role, coreNonce, clientNonce));
  const key = await hmacKey(token, "verify");
  return crypto.subtle.verify(HMAC, key, fromHex(proof), input).catch(() => false);
};
