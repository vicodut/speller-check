import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import { type DictionaryEntry, DictionaryFile } from "./dictionary-entry.schema";

/** Reads and updates the user's dictionary JSON file. A missing file is an empty dictionary. */
export class JsonDictionaryRepository {
  private pending: Promise<unknown> = Promise.resolve();

  constructor(private readonly path: string) {}

  async load(): Promise<Result<DictionaryEntry[], AppError>> {
    const file = Bun.file(this.path);
    if (!(await file.exists())) return ok([]);
    let raw: unknown;
    try {
      raw = await file.json();
    } catch (cause) {
      return err(
        appError(cause instanceof SyntaxError ? "dictionary_invalid" : "dictionary_read_failed"),
      );
    }
    const parsed = DictionaryFile.safeParse(raw);
    return parsed.success ? ok(parsed.data.entries) : err(appError("dictionary_invalid"));
  }

  /**
   * Appends `{ term }` unless an entry with that exact term exists. Writes atomically.
   * Adds are serialized so concurrent calls can't drop each other's term.
   */
  add(term: string): Promise<Result<void, AppError>> {
    const next = this.pending.then(() => this.addNow(term));
    this.pending = next;
    return next;
  }

  private async addNow(term: string): Promise<Result<void, AppError>> {
    const trimmed = term.trim();
    if (!trimmed) return err(appError("dictionary_write_failed"));
    const entries = await this.load();
    if (!entries.ok) return entries;
    if (entries.value.some((entry) => entry.term === trimmed)) return ok(undefined);
    return this.write({ entries: [...entries.value, { term: trimmed }] });
  }

  private async write(content: DictionaryFile): Promise<Result<void, AppError>> {
    const temp = `${this.path}.${randomBytes(6).toString("hex")}.tmp`;
    try {
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(temp, `${JSON.stringify(content, null, 2)}\n`, { mode: 0o600 });
      await rename(temp, this.path);
      return ok(undefined);
    } catch {
      await rm(temp, { force: true }).catch(() => undefined);
      return err(appError("dictionary_write_failed"));
    }
  }
}
