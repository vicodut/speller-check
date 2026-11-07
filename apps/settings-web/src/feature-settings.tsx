import type { FeatureSettingsView } from "@gc/protocol";

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

/** One feature's settings in effect, each with where its value comes from. */
export const FeatureSettings = ({ title, view }: { title: string; view: FeatureSettingsView }) => (
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
