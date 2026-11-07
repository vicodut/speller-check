import type { FeatureSettingsView } from "@gc/protocol";
import { useEffect, useReducer } from "react";
import { fetchSettings } from "./settings-api.client";
import { initialState, settingsPageReducer } from "./settings-page.reducer";

/** What to tell the user for each load error code. */
const ERROR_TEXT: Record<string, string> = {
  no_token: "This page needs the install token. Open it with `core settings`.",
  auth_failed: "The core rejected the token. Run `core settings` again to get a fresh link.",
  unreachable: "Can't reach the grammar checker core. Is it running?",
  bad_response: "The core answered with something this page doesn't understand.",
};

type Origin = { source: string; envVar?: string | undefined };

const Source = ({ origin }: { origin: Origin }) => (
  <span className={`source ${origin.source}`}>{origin.envVar ?? origin.source}</span>
);

const Row = ({ label, value, origin }: { label: string; value: string | null; origin: Origin }) => (
  <>
    <dt>{label}</dt>
    <dd className={value === null ? "none" : undefined}>{value ?? "not set"}</dd>
    <Source origin={origin} />
  </>
);

const Feature = ({ title, view }: { title: string; view: FeatureSettingsView }) => (
  <section aria-label={title}>
    <h2>{title}</h2>
    <dl>
      <Row label="Base URL" value={view.baseUrl.value} origin={view.baseUrl} />
      <Row label="Model" value={view.model.value} origin={view.model} />
      <Row
        label="Reasoning effort"
        value={view.reasoningEffort.value}
        origin={view.reasoningEffort}
      />
      <Row label="API key" value={view.apiKey.set ? "saved" : null} origin={view.apiKey} />
    </dl>
  </section>
);

/** Read-only for now (#32): the settings in effect and where each value comes from. */
export const SettingsPage = ({ token }: { token: string | null }) => {
  const [state, dispatch] = useReducer(settingsPageReducer, initialState);

  useEffect(() => {
    if (state.phase !== "loading") return;
    if (!token) return dispatch({ type: "failed", error: "no_token" });
    void fetchSettings(token).then((result) =>
      dispatch(
        result.ok
          ? { type: "loaded", view: result.value }
          : { type: "failed", error: result.error },
      ),
    );
  }, [state.phase, token]);

  return (
    <main>
      <h1>Grammar Checker settings</h1>
      <p className="lead">The model each feature uses, and where each value comes from.</p>
      {state.phase === "loading" && <p>Loading…</p>}
      {state.phase === "error" && (
        <section className="notice" role="alert">
          <p>{ERROR_TEXT[state.error] ?? `Couldn't load the settings (${state.error}).`}</p>
          <button type="button" onClick={() => dispatch({ type: "reload" })}>
            Try again
          </button>
        </section>
      )}
      {state.phase === "ready" && (
        <>
          <Feature title="Check" view={state.view.check} />
          <Feature title="Rephrase" view={state.view.rephrase} />
        </>
      )}
    </main>
  );
};
