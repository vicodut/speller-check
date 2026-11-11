import type { FeatureProfiles, ProfileSave, ProfilesView, SettingsView } from "@gc/protocol";
import { Alert, AlertDescription, Button } from "@gc/ui";
import { CircleAlert, LoaderCircle, RotateCw } from "lucide-react";
import { useCallback, useEffect, useReducer, useState } from "react";
import { errorText } from "./error-text.util";
import { ExtensionToken } from "./extension-token";
import { FeatureProfilesPanel } from "./feature-profiles";
import { FeatureSettings } from "./feature-settings";
import { LocalModelsPanel } from "./local-models-panel";
import { OllamaPanel } from "./ollama-panel";
import { useOllamaRuntime } from "./ollama-runtime.hook";
import { ProfileForm } from "./profile-form";
import { ProfileList } from "./profile-list";
import { useProfileProbe } from "./profile-probe.hook";
import { moveToLocal, profileUses } from "./profile-uses.util";
import {
  type ApiResult,
  activateProfile,
  deleteMovingToLocal,
  deleteProfile,
  fetchProfiles,
  fetchRuntime,
  fetchSettings,
  rotateToken,
  saveProfile,
  setFeatureProfiles,
  startOllama,
} from "./settings-api.client";
import { initialState, type SettingsPageEvent, settingsPageReducer } from "./settings-page.reducer";

/** The model the Ollama panel is about: the first feature's model served by Ollama. */
const ollamaModel = (view: SettingsView): string | null => {
  const onOllama = [view.check, view.rephrase].find((f) => f.baseUrl.value?.includes(":11434"));
  return (onOllama ?? view.check).model.value;
};

/** The settings in effect and the saved profiles, read together. */
const loadAll = async (token: string): Promise<SettingsPageEvent> => {
  const [view, profiles, runtime] = await Promise.all([
    fetchSettings(token),
    fetchProfiles(token),
    fetchRuntime(token),
  ]);
  if (!view.ok) return { type: "failed", error: view.error };
  if (!profiles.ok) return { type: "failed", error: profiles.error };
  const known = runtime.ok ? runtime.value : null;
  return { type: "loaded", view: view.value, profiles: profiles.value, runtime: known };
};

/** The model connection: the saved profiles, the one in use, and where each value comes from. */
type Props = {
  token: string | null;
  /** Keeps a rotated token for the next visit. */
  onTokenChange: (token: string) => void;
};

export const SettingsPage = ({ token: initialToken, onTokenChange }: Props) => {
  const [state, dispatch] = useReducer(settingsPageReducer, initialState);
  const [token, setToken] = useState(initialToken);

  useEffect(() => {
    if (state.phase !== "loading") return;
    if (!token) return dispatch({ type: "failed", error: "no_token" });
    void loadAll(token).then(dispatch);
  }, [state.phase, token]);

  const runtime = state.phase === "ready" ? state.runtime : null;
  const { onPull, onCancelPull } = useOllamaRuntime(runtime, token, dispatch);

  const probe = useProfileProbe(token, state.phase === "ready" ? state.form : null, dispatch);

  const onStartOllama = async () => {
    if (!token) return;
    dispatch({ type: "working" });
    const runtime = await startOllama(token);
    dispatch(runtime.ok ? await loadAll(token) : { type: "actionFailed", error: runtime.error });
  };

  /** The old token stops working as soon as the core answers, so the page switches at once. */
  const onRotateToken = async (): Promise<boolean> => {
    if (!token) return false;
    dispatch({ type: "working" });
    const rotated = await rotateToken(token);
    if (!rotated.ok) {
      dispatch({ type: "actionFailed", error: rotated.error });
      return false;
    }
    setToken(rotated.value.token);
    onTokenChange(rotated.value.token);
    dispatch(await loadAll(rotated.value.token));
    return true;
  };

  /** Runs a profile change, then reloads both views (activating changes the settings in effect). */
  const act = useCallback(
    async (change: (token: string) => Promise<ApiResult<ProfilesView>>) => {
      if (!token) return;
      dispatch({ type: "working" });
      const result = await change(token);
      dispatch(result.ok ? await loadAll(token) : { type: "actionFailed", error: result.error });
    },
    [token],
  );
  const onSave = (id: string | null, input: ProfileSave) =>
    void act((t) => saveProfile(t, id, input));
  const onActivate = (id: string) => void act((t) => activateProfile(t, id));
  /** A profile in use is moved off to Local first; the list asked the user before calling this. */
  const onDelete = (id: string) => {
    if (state.phase !== "ready") return;
    const plan = profileUses(state.profiles, id).length > 0 && moveToLocal(state.profiles, id);
    void act((t) => (plan ? deleteMovingToLocal(t, id, plan) : deleteProfile(t, id)));
  };
  const onFeatures = (features: FeatureProfiles) =>
    void act((t) => setFeatureProfiles(t, features));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-10 pb-16 text-sm">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">Grammar Checker settings</h1>
        <p className="m-0 text-muted-foreground">
          The model each feature uses, and where each value comes from.
        </p>
      </header>
      {state.phase === "loading" && (
        <p className="m-0 flex items-center gap-2 text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Loading…
        </p>
      )}
      {state.phase === "error" && (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>
            <p className="m-0">{errorText(state.error)}</p>
            <Button variant="outline" size="sm" onClick={() => dispatch({ type: "reload" })}>
              <RotateCw aria-hidden="true" /> Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {state.phase === "ready" && (
        <>
          <ProfileList
            profiles={state.profiles}
            busy={state.busy}
            dispatch={dispatch}
            onActivate={onActivate}
            onDelete={onDelete}
          />
          <FeatureProfilesPanel profiles={state.profiles} busy={state.busy} onChange={onFeatures} />
          {state.notice && (
            <Alert variant="destructive" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{errorText(state.notice)}</AlertDescription>
            </Alert>
          )}
          {state.runtime?.ollama.inUse && (
            <OllamaPanel
              ollama={state.runtime.ollama}
              model={ollamaModel(state.view)}
              busy={state.busy}
              onStart={() => void onStartOllama()}
              onPull={onPull}
              onCancelPull={onCancelPull}
            />
          )}
          <LocalModelsPanel token={token} />
          {state.form && (
            <ProfileForm
              form={state.form}
              busy={state.busy}
              dispatch={dispatch}
              onSave={onSave}
              {...probe}
            />
          )}
          <FeatureSettings title="Check" view={state.view.check} />
          <FeatureSettings title="Rephrase" view={state.view.rephrase} />
          {token && <ExtensionToken token={token} busy={state.busy} onRotate={onRotateToken} />}
        </>
      )}
    </main>
  );
};
