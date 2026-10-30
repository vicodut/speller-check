import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import { type DictionaryEntry, DictionaryFile } from "./dictionary-entry.schema";

/** Reads the user's dictionary from a JSON file. A missing file is an empty dictionary. */
export class JsonDictionaryRepository {
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
}
