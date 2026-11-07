import { join } from "node:path";

/** The only paths served, mapped to built files: nothing else under the folder is reachable. */
const FILES: Readonly<Record<string, { file: string; type: string }>> = {
  "/settings": { file: "index.html", type: "text/html; charset=utf-8" },
  "/settings/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/settings/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/settings/app.css": { file: "app.css", type: "text/css; charset=utf-8" },
};

/**
 * The page may only load its own script and style and call its own origin's API; it can't be
 * framed (clickjacking) and sends no referrer.
 */
const PAGE_HEADERS = {
  "content-security-policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; " +
    "img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
};

/** The built settings page (`apps/settings-web/dist`), served by the core at /settings. */
export class SettingsPageFiles {
  constructor(private readonly dir: string) {}

  /** Whether `pathname` is one of the page's files (the request then never reaches the WebSocket). */
  serves(pathname: string): boolean {
    return pathname === "/settings" || pathname.startsWith("/settings/");
  }

  /** The file for `pathname`, or null when it isn't one of the page's files or wasn't built. */
  async read(pathname: string): Promise<Response | null> {
    const entry = FILES[pathname];
    if (!entry) return null;
    const file = Bun.file(join(this.dir, entry.file));
    if (!(await file.exists())) return null;
    return new Response(file, { headers: { "content-type": entry.type, ...PAGE_HEADERS } });
  }
}
