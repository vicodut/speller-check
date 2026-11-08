import type { AppError } from "../../shared/errors";
import { ok, type Result } from "../../shared/result";
import type { KeyStore } from "./keychain.repository";
import type { SettingsFile } from "./settings-file.schema";

/**
 * Each profile's API key in the Keychain. Remembers only which profiles have one; the keys are
 * read from the Keychain when a model is built and never kept.
 */
export class ProfileKeys {
  private constructor(
    private readonly keys: KeyStore,
    private readonly keyed: Set<string>,
  ) {}

  static async load(keys: KeyStore, file: SettingsFile): Promise<ProfileKeys> {
    const found = await Promise.all(
      file.profiles.map(async (p) => [p.id, await keys.get(p.id)] as const),
    );
    return new ProfileKeys(
      keys,
      new Set(found.flatMap(([id, key]) => (key.ok && key.value ? [id] : []))),
    );
  }

  has(id: string): boolean {
    return this.keyed.has(id);
  }

  /** The profile's key, or null when it has none or the Keychain can't be read. */
  async read(id: string): Promise<string | null> {
    if (!this.keyed.has(id)) return null;
    const key = await this.keys.get(id);
    return key.ok ? key.value : null;
  }

  /** A string sets or replaces the key, null removes it, undefined leaves it. */
  async apply(id: string, apiKey: string | null | undefined): Promise<Result<void, AppError>> {
    if (apiKey === undefined) return ok(undefined);
    const result = apiKey === null ? await this.keys.remove(id) : await this.keys.set(id, apiKey);
    if (result.ok) {
      if (apiKey === null) this.keyed.delete(id);
      else this.keyed.add(id);
    }
    return result;
  }
}
