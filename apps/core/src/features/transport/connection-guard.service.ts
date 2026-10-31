import { timingSafeEqual } from "node:crypto";

/** Constant-time token comparison. Different lengths fail without comparing bytes. */
export const tokensMatch = (expected: string, given: string): boolean => {
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
