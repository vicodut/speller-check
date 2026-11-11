import type { ProfilesView } from "@gc/protocol";
import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  NativeSelect,
} from "@gc/ui";
import { TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { PRESETS } from "./profile-presets";
import { ConfirmMove, ProfileRow } from "./profile-row";
import { confirmText, profileUses } from "./profile-uses.util";
import type { SettingsPageEvent } from "./settings-page.reducer";

type Props = {
  profiles: ProfilesView;
  busy: boolean;
  dispatch: (event: SettingsPageEvent) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
};

const AddFromPreset = ({ dispatch }: Pick<Props, "dispatch">) => {
  const id = useId();
  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <label htmlFor={id} className="shrink-0 text-muted-foreground">
        Add a profile from
      </label>
      <NativeSelect
        id={id}
        value=""
        onChange={(e) => {
          const preset = PRESETS[Number(e.target.value)];
          if (preset) dispatch({ type: "add", input: preset.input });
        }}
      >
        <option value="" disabled>
          Choose a preset…
        </option>
        {PRESETS.map((preset, i) => (
          <option key={preset.label} value={i}>
            {preset.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
};

/** The saved profiles: pick the one in use, edit, delete, or add one from a preset. */
export const ProfileList = ({ profiles, busy, dispatch, onActivate, onDelete }: Props) => {
  const [confirming, setConfirming] = useState<string | null>(null);
  const askDelete = (id: string) => {
    if (profileUses(profiles, id).length > 0) setConfirming(id);
    else onDelete(id);
  };
  return (
    <Card aria-label="Profiles">
      <CardHeader>
        <CardTitle className="m-0 text-base">Profiles</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {profiles.lockedByEnv && (
          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>
              <p className="m-0">
                <code>GC_*</code> environment variables set the model, so saved profiles can't be
                used until the core restarts without them.
              </p>
            </AlertDescription>
          </Alert>
        )}
        <ul className="m-0 list-none divide-y divide-border rounded-lg border border-border p-0">
          {profiles.profiles.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <ProfileRow
                profile={p}
                active={p.id === profiles.activeProfileId}
                locked={profiles.lockedByEnv}
                busy={busy}
                onActivate={() => onActivate(p.id)}
                onEdit={() => dispatch({ type: "edit", id: p.id })}
                onDelete={() => askDelete(p.id)}
              />
              {confirming === p.id && (
                <ConfirmMove
                  question={confirmText(p.name, profileUses(profiles, p.id))}
                  onYes={() => {
                    setConfirming(null);
                    onDelete(p.id);
                  }}
                  onNo={() => setConfirming(null)}
                />
              )}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <AddFromPreset dispatch={dispatch} />
      </CardFooter>
    </Card>
  );
};
