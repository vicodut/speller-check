import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import { SettingsFile } from "./settings-file.schema";

/** The saved profiles (`settings.json`). Holds no API key; keys live in the Keychain (#34). */
export class SettingsFileRepository {
  constructor(private readonly path: string) {}

  /** The saved file, or null on first run (no file yet). An unreadable or invalid file fails. */
  async load(): Promise<Result<SettingsFile | null, AppError>> {
    let raw: string;
    try {
      raw = await readFile(this.path, "utf8");
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
      return missing ? ok(null) : err(appError("settings_read_failed"));
    }
    try {
      const parsed = SettingsFile.safeParse(JSON.parse(raw));
      return parsed.success ? ok(parsed.data) : err(appError("settings_read_failed"));
    } catch {
      return err(appError("settings_read_failed"));
    }
  }

  /** Writes a temp file then renames it over the old one, so a crash never leaves half a file. */
  async save(file: SettingsFile): Promise<Result<void, AppError>> {
    const temp = `${this.path}.${process.pid}.tmp`;
    try {
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(temp, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
      await rename(temp, this.path);
      return ok(undefined);
    } catch {
      return err(appError("settings_write_failed"));
    }
  }
}
