import type { Core } from "./core";
import { ProfileProbeProvider } from "../features/providers";
import { type SettingsService, toFeatureModel } from "../features/settings";
import type {
  LocalModelsPort,
  RuntimePort,
  TokenSource,
} from "../features/transport";
import { SettingsPageFiles, WebSocketServer } from "../features/transport";
import { FieldSessions } from "../features/check";
import { RephraseJobs } from "../features/rephrase";
import type { AppError } from "../shared/errors";
import type { Result } from "../shared/result";
import type { Logger } from "../shared/logger";

/**
 * The WebSocket server and settings page. `token` is read on every hello and API call;
 * `rotateToken` writes a new one, after which every connected client must hello again.
 */
export const createServer = (
  core: Core,
  options: {
    readonly port: number;
    readonly token: TokenSource;
    readonly rotateToken: () => Promise<Result<string, AppError>>;
    readonly settings: SettingsService;
    readonly runtime: RuntimePort;
    readonly localModels: LocalModelsPort;
    /** Folder of the built settings page (`apps/settings-web/dist`). */
    readonly settingsPageDir: string;
  },
  logger: Logger,
): WebSocketServer => {
  const rotate = async () => {
    const rotated = await options.rotateToken();
    if (rotated.ok) server.revokeAll();
    return rotated;
  };
  const server = new WebSocketServer(
    { port: options.port, token: options.token },
    {
      settingsView: () => options.settings.view(),
      profiles: options.settings,
      probe: new ProfileProbeProvider(
        (profileId: string | null, baseUrl: string) => options.settings.savedKeyFor(profileId, baseUrl),
        logger,
      ),
      runtime: options.runtime,
      localModels: options.localModels,
      tokens: { rotate },
      settingsPage: new SettingsPageFiles(options.settingsPageDir),
      createSession: (publish) => new FieldSessions(core.checkService, publish, logger),
      currentModels: async () => {
        const models = await options.settings.current();
        return { check: toFeatureModel(models.check), rephrase: toFeatureModel(models.rephrase) };
      },
      addDictionaryTerm: (term: string) => core.dictionary.add(term),
      createRephraser: (publish) => new RephraseJobs(core.rephraseService, publish),
    },
    logger,
  );
  return server;
};