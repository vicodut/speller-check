/** The names the core answers to; anything else is another site resolving to 127.0.0.1. */
const LOCAL_NAMES = ["127.0.0.1", "localhost"];

/**
 * Whether the `Host` header names the core itself. Refusing other names blocks DNS rebinding:
 * a website whose domain resolves to 127.0.0.1 still sends its own name here.
 */
export const isLocalHost = (host: string | null, port: number): boolean =>
  host !== null && LOCAL_NAMES.some((name) => host === `${name}:${port}`);

/**
 * Whether a request may come from where its `Origin` says. No Origin: a native client (curl,
 * the CLI). Otherwise only the core's own settings page; every website and the extension are
 * refused, so a page you visit can't call the settings API from your browser.
 */
export const isSameOrigin = (origin: string | null, port: number): boolean =>
  origin === null || LOCAL_NAMES.some((name) => origin === `http://${name}:${port}`);

/** The token of an `Authorization: Bearer <token>` header, or "" when there isn't one. */
export const bearerToken = (header: string | null): string =>
  header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
