import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import { StatisticsFile } from "./statistics-file.schema";

/** The statistics file, beside the settings file. Holds numbers and codes only. */
export class StatisticsFileRepository {
  constructor(private readonly path: string) {}

  /** The saved file, or null when there is none yet. An unreadable or invalid file fails. */
  async load(): Promise<Result<StatisticsFile | null, AppError>> {
    let raw: string;
    try {
      raw = await readFile(this.path, "utf8");
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
      return missing ? ok(null) : err(appError("statistics_read_failed"));
    }
    try {
      const parsed = StatisticsFile.safeParse(JSON.parse(raw));
      return parsed.success ? ok(parsed.data) : err(appError("statistics_read_failed"));
    } catch {
      return err(appError("statistics_read_failed"));
    }
  }

  /**
   * Writes a temp file then renames it over the old one, so a crash never leaves half a file. The
   * mode is set on a fresh temp file: a leftover one is removed first, since a mode is only applied
   * when a file is created.
   */
  async save(file: StatisticsFile): Promise<Result<void, AppError>> {
    const temp = `${this.path}.${process.pid}.tmp`;
    try {
      await mkdir(dirname(this.path), { recursive: true });
      await rm(temp, { force: true });
      await writeFile(temp, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600, flag: "wx" });
      await rename(temp, this.path);
      return ok(undefined);
    } catch {
      return err(appError("statistics_write_failed"));
    }
  }
}
