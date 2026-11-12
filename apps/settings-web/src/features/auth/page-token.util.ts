const PREFIX = "#token=";

/** Where pages before the in-memory change kept the install token. Only ever removed now. */
export const LEGACY_TOKEN_KEY = "gc.installToken";

/**
 * The install token for API calls. `core settings` opens the page with `#token=<token>`: the
 * fragment never reaches the server, and the page clears it from the address bar (`clearHash`).
 * The token lives in memory only: without a fragment there is no token, and the page asks for
 * `core settings` again.
 */
export const takeToken = (hash: string): { token: string | null; clearHash: boolean } => {
  if (!hash.startsWith(PREFIX)) return { token: null, clearHash: false };
  const fromLink = decodeURIComponent(hash.slice(PREFIX.length));
  return { token: fromLink || null, clearHash: true };
};

/**
 * Removes a token an older page stored, so no copy survives the upgrade. Run on every load: once
 * the key is gone it is a no-op, and nothing is written to mark it done. Blocked storage is ignored.
 */
export const forgetStoredToken = (storage: Pick<Storage, "removeItem"> | null): void => {
  try {
    storage?.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Storage blocked (private window, cleared site data): nothing stored to remove.
  }
};
