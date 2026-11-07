import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";

/** Where API keys live: one item per profile id. Never logged, never in a file or response. */
export type KeyStore = {
  get(profileId: string): Promise<Result<string | null, AppError>>;
  set(profileId: string, key: string): Promise<Result<void, AppError>>;
  remove(profileId: string): Promise<Result<void, AppError>>;
};

/** Keychain items this app owns. Tests use their own service name. */
export const KEYCHAIN_SERVICE = "GrammarChecker API key";
/** `security` exits with 44 when the item doesn't exist. */
const NOT_FOUND = 44;
/**
 * A key `security -i` can read inside double quotes: printable ASCII without `"`, `\` or spaces.
 * Every provider key we know fits; the page refuses anything else before it gets here.
 */
const SAFE_KEY = /^[!#-[\]-~]+$/;

type Run = { code: number; stdout: string };

/**
 * The macOS login Keychain through the system `security` command (no dependency). The key goes
 * through stdin (`security -i`), never the command line, so other processes can't see it in `ps`.
 */
export class SecurityKeychain implements KeyStore {
  constructor(private readonly service = KEYCHAIN_SERVICE) {}

  async get(profileId: string): Promise<Result<string | null, AppError>> {
    const run = await this.run(["find-generic-password", ...this.item(profileId), "-w"]);
    if (run.code === NOT_FOUND) return ok(null);
    if (run.code !== 0) return err(appError("keychain_failed"));
    return ok(run.stdout.replace(/\n$/, "") || null);
  }

  async set(profileId: string, key: string): Promise<Result<void, AppError>> {
    if (!SAFE_KEY.test(key) || !SAFE_KEY.test(profileId)) return err(appError("body_invalid"));
    const command = `add-generic-password -U -s "${this.service}" -a "${profileId}" -w "${key}"\n`;
    const run = await this.run(["-i"], command);
    return run.code === 0 ? ok(undefined) : err(appError("keychain_failed"));
  }

  async remove(profileId: string): Promise<Result<void, AppError>> {
    const run = await this.run(["delete-generic-password", ...this.item(profileId)]);
    return run.code === 0 || run.code === NOT_FOUND
      ? ok(undefined)
      : err(appError("keychain_failed"));
  }

  private item(profileId: string): string[] {
    return ["-s", this.service, "-a", profileId];
  }

  private async run(args: string[], stdin?: string): Promise<Run> {
    try {
      const child = Bun.spawn(["/usr/bin/security", ...args], {
        stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
        stdout: "pipe",
        stderr: "ignore",
      });
      const [stdout, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
      return { code, stdout };
    } catch {
      return { code: -1, stdout: "" };
    }
  }
}
