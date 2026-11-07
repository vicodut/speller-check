/**
 * The settings page link. The token goes in the fragment (`#token=`), which the browser never
 * sends to the server; the page stores it and clears it from the address bar.
 */
export const settingsUrl = (port: number, token: string): string =>
  `http://127.0.0.1:${port}/settings#token=${encodeURIComponent(token)}`;
