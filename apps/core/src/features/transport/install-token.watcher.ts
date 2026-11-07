import { readFileSync, statSync } from "node:fs";
import { InstallToken } from "./install-token.repository";

/** What identifies one version of the file: a rotation renames a new file over it. */
type Stamp = { readonly ino: number; readonly mtimeMs: number; readonly size: number };

const sameStamp = (a: Stamp, b: Stamp): boolean =>
  a.ino === b.ino && a.mtimeMs === b.mtimeMs && a.size === b.size;

/**
 * The install token a running core accepts right now. Each call stats the token file and
 * re-reads it only when it changed, so `core token --rotate` takes effect without a restart.
 * Fails closed: a missing or invalid file gives null, which no client token matches.
 */
export class InstallTokenWatcher {
  private stamp: Stamp | null;
  private token: string | null;

  constructor(
    private readonly path: string,
    initialToken: string,
  ) {
    this.stamp = this.stat();
    this.token = initialToken;
  }

  current(): string | null {
    const stamp = this.stat();
    if (!stamp) {
      this.stamp = null;
      this.token = null;
      return null;
    }
    if (this.stamp && sameStamp(stamp, this.stamp)) return this.token;
    this.stamp = stamp;
    this.token = this.read();
    return this.token;
  }

  private stat(): Stamp | null {
    try {
      const { ino, mtimeMs, size } = statSync(this.path);
      return { ino, mtimeMs, size };
    } catch {
      return null;
    }
  }

  private read(): string | null {
    try {
      const parsed = InstallToken.safeParse(readFileSync(this.path, "utf8"));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
}
