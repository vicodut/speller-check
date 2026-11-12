import type { Feature, FeatureProfiles, ProfilesView } from "@gc/protocol";
import { NativeSelect } from "@gc/ui";
import { ChevronRight } from "lucide-react";
import { useId } from "react";

type Props = {
  profiles: ProfilesView;
  busy: boolean;
  onChange: (features: FeatureProfiles) => void;
};

const ROWS: readonly { feature: Feature; label: string }[] = [
  { feature: "check", label: "Check" },
  { feature: "rephrase", label: "Rephrase" },
];

type RowProps = Props & { feature: Feature; label: string; sameAsActive: string };

const FeatureRow = ({ profiles, busy, onChange, feature, label, sameAsActive }: RowProps) => {
  const id = useId();
  return (
    <div className="grid gap-2 sm:grid-cols-[6rem_1fr] sm:items-center sm:gap-4">
      <label htmlFor={id} className="text-muted-foreground">
        {label}
      </label>
      <NativeSelect
        id={id}
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
      </NativeSelect>
    </div>
  );
};

/**
 * "Advanced: a model per feature", collapsed by default: Check and Rephrase each use the active
 * profile ("same as active") or one of their own. Locked while env vars set the model.
 */
export const FeatureProfilesPanel = (props: Props) => {
  const { profiles } = props;
  const active = profiles.profiles.find((p) => p.id === profiles.activeProfileId);
  const sameAsActive = active ? `Same as active (${active.name})` : "Same as active";
  return (
    <details
      data-slot="card"
      className="group rounded-xl border border-border bg-card text-card-foreground shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-6 py-4 font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
        />
        Advanced: a model per feature
      </summary>
      <div className="flex flex-col gap-3 px-6 pb-6">
        {profiles.lockedByEnv && (
          <p className="m-0 text-muted-foreground">
            <code>GC_*</code> environment variables set the model for both features.
          </p>
        )}
        {ROWS.map(({ feature, label }) => (
          <FeatureRow
            key={feature}
            {...props}
            feature={feature}
            label={label}
            sameAsActive={sameAsActive}
          />
        ))}
      </div>
    </details>
  );
};
