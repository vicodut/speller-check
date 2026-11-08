import type { Feature, FeatureProfiles, ProfilesView } from "@gc/protocol";

type Props = {
  profiles: ProfilesView;
  busy: boolean;
  onChange: (features: FeatureProfiles) => void;
};

const ROWS: readonly { feature: Feature; label: string }[] = [
  { feature: "check", label: "Check" },
  { feature: "rephrase", label: "Rephrase" },
];

/**
 * "Advanced: a model per feature", collapsed by default: Check and Rephrase each use the active
 * profile ("same as active") or one of their own. Locked while env vars set the model.
 */
export const FeatureProfilesPanel = ({ profiles, busy, onChange }: Props) => {
  const active = profiles.profiles.find((p) => p.id === profiles.activeProfileId);
  const sameAsActive = active ? `Same as active (${active.name})` : "Same as active";
  return (
    <details className="advanced">
      <summary>Advanced: a model per feature</summary>
      {profiles.lockedByEnv && (
        <p className="hint">
          <code>GC_*</code> environment variables set the model for both features.
        </p>
      )}
      {ROWS.map(({ feature, label }) => (
        <label key={feature} className="feature-profile">
          <span className="feature-name">{label}</span>
          <select
            value={profiles.features[feature] ?? ""}
            disabled={busy || profiles.lockedByEnv}
            onChange={(e) => onChange({ ...profiles.features, [feature]: e.target.value || null })}
          >
            <option value="">{sameAsActive}</option>
            {profiles.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.local ? "local" : "cloud"} · {p.model}
              </option>
            ))}
          </select>
        </label>
      ))}
    </details>
  );
};
