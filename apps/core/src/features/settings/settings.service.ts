import type { ProfileSave, ProfilesView, SettingsView } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import type { KeyStore } from "./keychain.repository";
import {
  activateProfile,
  activeProfile,
  addProfile,
  firstRunFile,
  isLocalUrl,
  markBuiltIn,
  removeProfile,
  sameOrigin,
  updateProfile,
} from "./profiles.util";
import type { Env } from "./settings.loader";
import type { ModelConfig } from "./settings.schema";
import type { SettingsFileRepository } from "./settings-file.repository";
import type { Profile, SettingsFile } from "./settings-file.schema";
import { buildSettingsView, profileSettingsView } from "./settings-view.builder";

type Store = Pick<SettingsFileRepository, "load" | "save">;
export type ModelListener = (config: ModelConfig) => void;

const toConfig = (p: Profile): ModelConfig => ({
  baseUrl: p.baseUrl.replace(/\/+$/, ""),
  model: p.model,
  ...(p.reasoningEffort ? { reasoningEffort: p.reasoningEffort } : {}),
});

/** Which profiles have a key in the Keychain; the keys themselves aren't kept. */
const keyedIds = async (keys: KeyStore, file: SettingsFile): Promise<Set<string>> => {
  const found = await Promise.all(
    file.profiles.map(async (p) => [p.id, await keys.get(p.id)] as const),
  );
  return new Set(found.flatMap(([id, key]) => (key.ok && key.value ? [id] : [])));
};

/**
 * The model settings the core runs with: the saved profiles (keys in the Keychain), or a locked
 * "Environment" model when `GC_*` env vars give one. Every change is saved first; a change to the
 * model in use then tells the listeners (which swap providers and notify clients).
 */
export class SettingsService {
  private readonly listeners: ModelListener[] = [];

  private constructor(
    private file: SettingsFile,
    private readonly store: Store,
    private readonly keys: KeyStore,
    private readonly keyed: Set<string>,
    private readonly env: Env,
    private readonly envModel: ModelConfig | null,
    private readonly newId: () => string,
  ) {}

  /** Loads the saved profiles, creating and saving the first-run "Local" one if there are none. */
  static async open(
    store: Store,
    keys: KeyStore,
    env: Env,
    envModel: ModelConfig | null,
    newId: () => string = () => crypto.randomUUID(),
  ): Promise<Result<SettingsService, AppError>> {
    const loaded = await store.load();
    if (!loaded.ok) return loaded;
    const file = loaded.value ? markBuiltIn(loaded.value) : firstRunFile(newId());
    if (file !== loaded.value) {
      const saved = await store.save(file);
      if (!saved.ok) return saved;
    }
    const keyed = await keyedIds(keys, file);
    return ok(new SettingsService(file, store, keys, keyed, env, envModel, newId));
  }

  /** The model in use now: the env one if given, else the active profile's with its key. */
  async current(): Promise<ModelConfig> {
    if (this.envModel) return this.envModel;
    const profile = activeProfile(this.file);
    const key = this.keyed.has(profile.id) ? await this.keys.get(profile.id) : null;
    const apiKey = key?.ok ? key.value : null;
    return { ...toConfig(profile), ...(apiKey ? { apiKey } : {}) };
  }

  view(): SettingsView {
    if (this.envModel) return buildSettingsView(this.env, this.envModel);
    const profile = activeProfile(this.file);
    return profileSettingsView(profile, this.keyed.has(profile.id));
  }

  profiles(): ProfilesView {
    return {
      profiles: this.file.profiles.map((p) => ({
        ...p,
        local: isLocalUrl(p.baseUrl),
        builtIn: p.id === this.file.builtInProfileId,
        hasKey: this.keyed.has(p.id),
      })),
      activeProfileId: this.envModel ? null : this.file.activeProfileId,
      lockedByEnv: this.envModel !== null,
    };
  }

  /**
   * The key saved for a profile, for a test or model list from the page. Only while `baseUrl`
   * stays on the saved profile's host, so editing the URL never sends the key elsewhere.
   */
  async savedKeyFor(profileId: string | null, baseUrl: string): Promise<string | null> {
    const profile = this.file.profiles.find((p) => p.id === profileId);
    if (!profile || !this.keyed.has(profile.id) || !sameOrigin(profile.baseUrl, baseUrl))
      return null;
    const key = await this.keys.get(profile.id);
    return key.ok ? key.value : null;
  }

  onChange(listener: ModelListener): void {
    this.listeners.push(listener);
  }

  /** The key is stored first: a profile is never saved claiming a key the Keychain refused. */
  async create({ apiKey, ...input }: ProfileSave): Promise<Result<ProfilesView, AppError>> {
    const id = this.newId();
    const key = await this.applyKey(id, apiKey);
    if (!key.ok) return key;
    const result = await this.commit(ok(addProfile(this.file, input, id)), null);
    if (!result.ok && apiKey) await this.applyKey(id, null);
    return result;
  }

  async update(
    id: string,
    { apiKey, ...input }: ProfileSave,
  ): Promise<Result<ProfilesView, AppError>> {
    const next = updateProfile(this.file, id, input);
    if (!next.ok) return next;
    const key = await this.applyKey(id, apiKey);
    if (!key.ok) return key;
    return this.commit(next, apiKey === undefined ? null : id);
  }

  /** Deleting a profile deletes its Keychain item too. */
  async remove(id: string): Promise<Result<ProfilesView, AppError>> {
    const result = await this.commit(removeProfile(this.file, id), null);
    if (result.ok && this.keyed.has(id)) {
      await this.applyKey(id, null);
      return ok(this.profiles());
    }
    return result;
  }

  /** Refused while env vars give the model: the page must not claim a profile is in use. */
  activate(id: string): Promise<Result<ProfilesView, AppError>> {
    if (this.envModel) return Promise.resolve(err(appError("settings_locked")));
    return this.commit(activateProfile(this.file, id), null);
  }

  /** A string sets or replaces the key, null removes it, undefined leaves it. */
  private async applyKey(
    id: string,
    apiKey: string | null | undefined,
  ): Promise<Result<void, AppError>> {
    if (apiKey === undefined) return ok(undefined);
    const result = apiKey === null ? await this.keys.remove(id) : await this.keys.set(id, apiKey);
    if (result.ok) {
      if (apiKey === null) this.keyed.delete(id);
      else this.keyed.add(id);
    }
    return result;
  }

  /** `keyChanged`: the profile whose key just changed; the model changes if it's the active one. */
  private async commit(
    next: Result<SettingsFile, AppError>,
    keyChanged: string | null,
  ): Promise<Result<ProfilesView, AppError>> {
    if (!next.ok) return next;
    const before = JSON.stringify(this.inUse());
    const saved = await this.store.save(next.value);
    if (!saved.ok) return saved;
    this.file = next.value;
    const keyInUse = !this.envModel && keyChanged === this.file.activeProfileId;
    if (JSON.stringify(this.inUse()) !== before || keyInUse) {
      const config = await this.current();
      for (const listener of this.listeners) listener(config);
    }
    return ok(this.profiles());
  }

  /** The model in use without its key, to tell whether a change touched it. */
  private inUse(): ModelConfig {
    return this.envModel ?? toConfig(activeProfile(this.file));
  }
}
