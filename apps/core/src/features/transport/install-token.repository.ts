import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";

const TOKEN_BYTES = 32;

/** base64url of 32 bytes is 43 chars; accept any reasonably long base64url token. */
const InstallToken = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{32,}$/);

const isMissing = (cause: unknown): boolean =>
  typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT";

/** Per-install token shared with clients. Created once, readable by the user only (0600). */
export class InstallTokenRepository {
  constructor(private readonly path: string) {}

  async loadOrCreate(): Promise<Result<string, AppError>> {
    let raw: string;
    try {
      raw = await readFile(this.path, "utf8");
    } catch (cause) {
      return isMissing(cause) ? this.create() : err(appError("token_read_failed"));
    }
    const parsed = InstallToken.safeParse(raw);
    return parsed.success ? ok(parsed.data) : err(appError("token_read_failed"));
  }

  private async create(): Promise<Result<string, AppError>> {
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    try {
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      // `wx` fails if another process created the file in between, instead of overwriting it.
      await writeFile(this.path, token, { mode: 0o600, flag: "wx" });
      await chmod(this.path, 0o600);
    } catch {
      return err(appError("token_read_failed"));
    }
    return ok(token);
  }
}
