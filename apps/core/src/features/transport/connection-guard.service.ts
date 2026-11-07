import { timingSafeEqual } from "node:crypto";

/**
 * The token the core accepts: fixed (tests), or read on every check so a rotation applies
 * without a restart. null: none can be read, so nothing is accepted.
 */
export type TokenSource = string | (() => string | null);

export const currentToken = (source: TokenSource): string | null =>
  typeof source === "string" ? source : source();

/**
 * Constant-time token comparison. Different lengths fail without comparing bytes, and no
 * expected token (missing or unreadable file) matches nothing, not even an empty one.
 */
export const tokensMatch = (expected: string | null, given: string): boolean => {
  if (!expected) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(given, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Native clients send no Origin; the Chrome extension sends `chrome-extension://<id>`.
 * Anything else is a web page and is refused before the upgrade.
 */
export const isAllowedOrigin = (origin: string | null): boolean =>
  origin === null || /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
