import type { ProfileInput, ProfilesView } from "@gc/protocol";
import { useCallback, useEffect, useReducer } from "react";
import { FeatureSettings } from "./feature-settings";
import { ProfileForm } from "./profile-form";
import { ProfileList } from "./profile-list";
import {
  type ApiResult,
  activateProfile,
  deleteProfile,
  fetchProfiles,
  fetchSettings,
  saveProfile,
} from "./settings-api.client";
import { initialState, type SettingsPageEvent, settingsPageReducer } from "./settings-page.reducer";

/** What to tell the user for each error code. */
const ERROR_TEXT: Record<string, string> = {
  no_token: "This page needs the install token. Open it with `core settings`.",
  auth_failed: "The core rejected the token. Run `core settings` again to get a fresh link.",
  unreachable: "Can't reach the grammar checker core. Is it running?",
  bad_response: "The core answered with something this page doesn't understand.",
  body_invalid: "Check the profile: it needs a name, an http(s) base URL and a model.",
  profile_active: "That profile is in use. Switch to another one before deleting it.",
  profile_builtin: "The Local profile can't be deleted; you can edit it.",
  profile_not_found: "That profile no longer exists. Reload the page.",
  settings_locked: "GC_* environment variables set the model, so profiles can't be switched.",
  settings_write_failed: "The core couldn't save the settings file.",
};
const errorText = (code: string) => ERROR_TEXT[code] ?? `Something went wrong (${code}).`;

/** The settings in effect and the saved profiles, read together. */
const loadAll = async (token: string): Promise<SettingsPageEvent> => {
  const [view, profiles] = await Promise.all([fetchSettings(token), fetchProfiles(token)]);
  if (!view.ok) return { type: "failed", error: view.error };
  if (!profiles.ok) return { type: "failed", error: profiles.error };
  return { type: "loaded", view: view.value, profiles: profiles.value };
};

/** The model connection: the saved profiles, the one in use, and where each value comes from. */
export const SettingsPage = ({ token }: { token: string | null }) => {
  const [state, dispatch] = useReducer(settingsPageReducer, initialState);

  useEffect(() => {
    if (state.phase !== "loading") return;
    if (!token) return dispatch({ type: "failed", error: "no_token" });
    void loadAll(token).then(dispatch);
  }, [state.phase, token]);

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
  const onSave = (id: string | null, input: ProfileInput) =>
    void act((t) => saveProfile(t, id, input));
  const onActivate = (id: string) => void act((t) => activateProfile(t, id));
  const onDelete = (id: string) => void act((t) => deleteProfile(t, id));

  return (
    <main>
      <h1>Grammar Checker settings</h1>
      <p className="lead">The model each feature uses, and where each value comes from.</p>
      {state.phase === "loading" && <p>Loading…</p>}
      {state.phase === "error" && (
        <section className="notice" role="alert">
          <p>{errorText(state.error)}</p>
          <button type="button" onClick={() => dispatch({ type: "reload" })}>
            Try again
          </button>
        </section>
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
          {state.notice && (
            <p className="notice" role="alert">
              {errorText(state.notice)}
            </p>
          )}
          {state.form && (
            <ProfileForm form={state.form} busy={state.busy} dispatch={dispatch} onSave={onSave} />
          )}
          <FeatureSettings title="Check" view={state.view.check} />
          <FeatureSettings title="Rephrase" view={state.view.rephrase} />
        </>
      )}
    </main>
  );
};
