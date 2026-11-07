import type { ProfileInput, ProfileSave, ReasoningEffort } from "@gc/protocol";
import { type FormEvent, useId } from "react";
import { ModelField } from "./model-field";
import { ProfileTest } from "./profile-test";
import {
  type ProfileForm as Form,
  keyChange,
  type SettingsPageEvent,
} from "./settings-page.reducer";

const EFFORTS: readonly ReasoningEffort[] = ["none", "low", "medium", "high"];

type Props = {
  form: Form;
  busy: boolean;
  dispatch: (event: SettingsPageEvent) => void;
  onSave: (id: string | null, input: ProfileSave) => void;
  onListModels: () => void;
  onTest: () => void;
};

type FieldProps = { label: string; id: string; children: React.ReactNode };

const Field = ({ label, id, children }: FieldProps) => (
  <div className="field">
    <label htmlFor={id}>{label}</label>
    {children}
  </div>
);

/** The key is write-only: the page never gets it back, only whether one is saved. */
const KeyInput = ({ form, id, dispatch }: Pick<Props, "form" | "dispatch"> & { id: string }) => (
  <Field label="API key" id={id}>
    <div className="key">
      <input
        id={id}
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder={
          form.key.saved ? "Saved in Keychain: type to replace" : "Not needed for local models"
        }
        value={form.key.typed}
        onChange={(e) => dispatch({ type: "key", typed: e.target.value })}
      />
      {form.key.saved && (
        <label className="remove-key">
          <input
            type="checkbox"
            checked={form.key.remove}
            onChange={(e) => dispatch({ type: "removeKey", remove: e.target.checked })}
          />
          Remove
        </label>
      )}
    </div>
  </Field>
);

/** Add or edit one profile. The key goes to the macOS Keychain, never to the settings file. */
export const ProfileForm = ({ form, busy, dispatch, onSave, onListModels, onTest }: Props) => {
  const { draft } = form;
  const id = useId();
  const set = (field: keyof ProfileInput) => (value: string) =>
    dispatch({ type: "draft", field, value });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const apiKey = keyChange(form.key);
    onSave(form.id, apiKey === undefined ? draft : { ...draft, apiKey });
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
      <ModelField
        id={`${id}-model`}
        value={draft.model}
        models={form.probe.models}
        onChange={set("model")}
        onReload={onListModels}
      />
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
      <KeyInput form={form} id={`${id}-key`} dispatch={dispatch} />
      <div className="actions">
        <button type="submit" disabled={busy}>
          Save
        </button>
        <button type="button" onClick={() => dispatch({ type: "cancel" })}>
          Cancel
        </button>
        <ProfileTest test={form.probe.test} onTest={onTest} />
      </div>
    </form>
  );
};
