import type { ProfileInput, ProfilesView, SettingsView } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import {
  activateProfile,
  activeProfile,
  addProfile,
  firstRunFile,
  isLocalUrl,
  removeProfile,
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

/**
 * The model settings the core runs with: the saved profiles, or a locked "Environment" model
 * when `GC_*` env vars give one. Every change is saved first; a change to the model in use
 * then tells the listeners (which swap providers and notify clients).
 */
export class SettingsService {
  private readonly listeners: ModelListener[] = [];

  private constructor(
    private file: SettingsFile,
    private readonly store: Store,
    private readonly env: Env,
    private readonly envModel: ModelConfig | null,
    private readonly newId: () => string,
  ) {}

  /** Loads the saved profiles, creating and saving the first-run "Local" one if there are none. */
  static async open(
    store: Store,
    env: Env,
    envModel: ModelConfig | null,
    newId: () => string = () => crypto.randomUUID(),
  ): Promise<Result<SettingsService, AppError>> {
    const loaded = await store.load();
    if (!loaded.ok) return loaded;
    let file = loaded.value;
    if (!file) {
      file = firstRunFile(newId());
      const saved = await store.save(file);
      if (!saved.ok) return saved;
    }
    return ok(new SettingsService(file, store, env, envModel, newId));
  }

  /** The model in use now: the env one if given, else the active profile's. */
  current(): ModelConfig {
    return this.envModel ?? toConfig(activeProfile(this.file));
  }

  view(): SettingsView {
    return this.envModel
      ? buildSettingsView(this.env, this.envModel)
      : profileSettingsView(activeProfile(this.file));
  }

  profiles(): ProfilesView {
    return {
      profiles: this.file.profiles.map((p) => ({ ...p, local: isLocalUrl(p.baseUrl) })),
      activeProfileId: this.envModel ? null : this.file.activeProfileId,
      lockedByEnv: this.envModel !== null,
    };
  }

  onChange(listener: ModelListener): void {
    this.listeners.push(listener);
  }

  create(input: ProfileInput): Promise<Result<ProfilesView, AppError>> {
    return this.commit(ok(addProfile(this.file, input, this.newId())));
  }

  update(id: string, input: ProfileInput): Promise<Result<ProfilesView, AppError>> {
    return this.commit(updateProfile(this.file, id, input));
  }

  remove(id: string): Promise<Result<ProfilesView, AppError>> {
    return this.commit(removeProfile(this.file, id));
  }

  /** Refused while env vars give the model: the page must not claim a profile is in use. */
  activate(id: string): Promise<Result<ProfilesView, AppError>> {
    if (this.envModel) return Promise.resolve(err(appError("settings_locked")));
    return this.commit(activateProfile(this.file, id));
  }

  private async commit(
    next: Result<SettingsFile, AppError>,
  ): Promise<Result<ProfilesView, AppError>> {
    if (!next.ok) return next;
    const before = JSON.stringify(this.current());
    const saved = await this.store.save(next.value);
    if (!saved.ok) return saved;
    this.file = next.value;
    const after = this.current();
    if (JSON.stringify(after) !== before) for (const listener of this.listeners) listener(after);
    return ok(this.profiles());
  }
}
