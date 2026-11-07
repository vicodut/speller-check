import type { ProfileInput, ReasoningEffort } from "@gc/protocol";
import { type FormEvent, useId } from "react";
import type { ProfileForm as Form, SettingsPageEvent } from "./settings-page.reducer";

const EFFORTS: readonly ReasoningEffort[] = ["none", "low", "medium", "high"];

type Props = {
  form: Form;
  busy: boolean;
  dispatch: (event: SettingsPageEvent) => void;
  onSave: (id: string | null, input: ProfileInput) => void;
};

type FieldProps = { label: string; id: string; children: React.ReactNode };

const Field = ({ label, id, children }: FieldProps) => (
  <div className="field">
    <label htmlFor={id}>{label}</label>
    {children}
  </div>
);

/** Add or edit one profile. No API key field yet: keys go to the Keychain (#34). */
export const ProfileForm = ({ form, busy, dispatch, onSave }: Props) => {
  const { draft } = form;
  const id = useId();
  const set = (field: keyof ProfileInput) => (value: string) =>
    dispatch({ type: "draft", field, value });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(form.id, draft);
  };
  return (
    <form className="profile-form" onSubmit={submit} aria-label="Profile">
      <h3>{form.id === null ? "New profile" : "Edit profile"}</h3>
      <Field label="Name" id={`${id}-name`}>
        <input
          id={`${id}-name`}
          value={draft.name}
          onChange={(e) => set("name")(e.target.value)}
          required
        />
      </Field>
      <Field label="Base URL" id={`${id}-url`}>
        <input
          id={`${id}-url`}
          type="url"
          value={draft.baseUrl}
          onChange={(e) => set("baseUrl")(e.target.value)}
          required
        />
      </Field>
      <Field label="Model" id={`${id}-model`}>
        <input
          id={`${id}-model`}
          value={draft.model}
          onChange={(e) => set("model")(e.target.value)}
          required
        />
      </Field>
      <Field label="Reasoning effort" id={`${id}-effort`}>
        <select
          id={`${id}-effort`}
          value={draft.reasoningEffort ?? ""}
          onChange={(e) =>
            dispatch({ type: "draft", field: "reasoningEffort", value: e.target.value || null })
          }
        >
          <option value="">Model default</option>
          {EFFORTS.map((effort) => (
            <option key={effort} value={effort}>
              {effort}
            </option>
          ))}
        </select>
      </Field>
      <div className="actions">
        <button type="submit" disabled={busy}>
          Save
        </button>
        <button type="button" onClick={() => dispatch({ type: "cancel" })}>
          Cancel
        </button>
      </div>
    </form>
  );
};
