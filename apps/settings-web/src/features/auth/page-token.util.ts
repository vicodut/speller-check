const PREFIX = "#token=";

/**
 * The install token for API calls. `core settings` opens the page with `#token=<token>`: the
 * fragment never reaches the server, and the page stores it and then clears it from the address
 * bar (`clearHash`). A fresh link wins over a stored token, so a rotated token takes over.
 */
export const takeToken = (
  hash: string,
  stored: string | null,
): { token: string | null; clearHash: boolean } => {
  if (!hash.startsWith(PREFIX)) return { token: stored, clearHash: false };
  const fromLink = decodeURIComponent(hash.slice(PREFIX.length));
  return { token: fromLink || stored, clearHash: true };
};
