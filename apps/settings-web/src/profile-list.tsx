import type { ProfilesView } from "@gc/protocol";
import { useState } from "react";
import { PRESETS } from "./profile-presets";
import { confirmText, profileUses } from "./profile-uses.util";
import type { SettingsPageEvent } from "./settings-page.reducer";

type Props = {
  profiles: ProfilesView;
  busy: boolean;
  dispatch: (event: SettingsPageEvent) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
};

const host = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

type ConfirmProps = { question: string; onYes: () => void; onNo: () => void };

/** Asked before deleting a profile in use: its uses move to Local, which can't be deleted. */
const ConfirmMove = ({ question, onYes, onNo }: ConfirmProps) => (
  <div className="confirm" role="alert">
    <p>{question}</p>
    <button type="button" onClick={onYes}>
      Switch to Local and delete
    </button>
    <button type="button" onClick={onNo}>
      Cancel
    </button>
  </div>
);

/** The saved profiles: pick the one in use, edit, delete, or add one from a preset. */
export const ProfileList = ({ profiles, busy, dispatch, onActivate, onDelete }: Props) => {
  const [confirming, setConfirming] = useState<string | null>(null);
  const askDelete = (id: string) => {
    if (profileUses(profiles, id).length > 0) setConfirming(id);
    else onDelete(id);
  };
  return (
    <section aria-label="Profiles">
      <h2>Profiles</h2>
      {profiles.lockedByEnv && (
        <p className="notice">
          <code>GC_*</code> environment variables set the model, so saved profiles can't be used
          until the core restarts without them.
        </p>
      )}
      <ul className="profiles">
        {profiles.profiles.map((p) => {
          const active = p.id === profiles.activeProfileId;
          return (
            <li key={p.id} className={active ? "active" : undefined}>
              <label>
                <input
                  type="radio"
                  name="active-profile"
                  checked={active}
                  disabled={busy || profiles.lockedByEnv}
                  onChange={() => onActivate(p.id)}
                />
                <strong>{p.name}</strong>
                <span className={`kind ${p.local ? "local" : "cloud"}`}>
                  {p.local ? "local" : "cloud"}
                </span>
                <span className="model">{p.model}</span>
                {p.hasKey && <span className="has-key">key saved</span>}
              </label>
              <button type="button" onClick={() => dispatch({ type: "edit", id: p.id })}>
                Edit
              </button>
              {!p.builtIn && (
                <button
                  type="button"
                  disabled={busy || profiles.lockedByEnv}
                  onClick={() => askDelete(p.id)}
                >
                  Delete
                </button>
              )}
              {!p.local && <p className="sent-to">Your text is sent to {host(p.baseUrl)}</p>}
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
          );
        })}
      </ul>
      <label className="add">
        <span>Add a profile from</span>
        <select
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
        </select>
      </label>
    </section>
  );
};
