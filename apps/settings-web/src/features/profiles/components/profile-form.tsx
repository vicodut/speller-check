import type { ProfileInput, ProfileSave, ReasoningEffort } from "@gc/protocol";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  NativeSelect,
} from "@gc/ui";
import { Save } from "lucide-react";
import { type FormEvent, useId } from "react";
import {
  type ProfileForm as Form,
  keyChange,
  type SettingsPageEvent,
} from "../../../lib/settings-page.model";
import { ModelField } from "../../models";
import { ProfileTest } from "./profile-test";

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
  <div className="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-4">
    <Label htmlFor={id} className="text-muted-foreground">
      {label}
    </Label>
    {children}
  </div>
);

/** The key is write-only: the page never gets it back, only whether one is saved. */
const KeyInput = ({ form, id, dispatch }: Pick<Props, "form" | "dispatch"> & { id: string }) => (
  <Field label="API key" id={id}>
    <div className="flex items-center gap-3">
      <Input
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
        <Label className="shrink-0 cursor-pointer font-normal text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 cursor-pointer accent-primary"
            checked={form.key.remove}
            onChange={(e) => dispatch({ type: "removeKey", remove: e.target.checked })}
          />
          Remove
        </Label>
      )}
    </div>
  </Field>
);

type EffortProps = Pick<Props, "dispatch"> & { id: string; value: ReasoningEffort | null };

const EffortField = ({ id, value, dispatch }: EffortProps) => (
  <Field label="Reasoning effort" id={id}>
    <NativeSelect
      id={id}
      value={value ?? ""}
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
    </NativeSelect>
  </Field>
);

type ActionsProps = Pick<Props, "busy" | "dispatch" | "onTest"> & {
  test: Form["probe"]["test"];
};

const FormActions = ({ busy, dispatch, test, onTest }: ActionsProps) => (
  <CardFooter className="flex-wrap gap-2">
    <Button type="submit" disabled={busy}>
      <Save aria-hidden="true" /> Save
    </Button>
    <Button variant="outline" onClick={() => dispatch({ type: "cancel" })}>
      Cancel
    </Button>
    <ProfileTest test={test} onTest={onTest} />
  </CardFooter>
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
    <Card className="border-primary/60 py-0">
      <form className="flex flex-col gap-6 py-6" onSubmit={submit} aria-label="Profile">
        <CardHeader>
          <CardTitle className="m-0 text-base">
            {form.id === null ? "New profile" : "Edit profile"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Name" id={`${id}-name`}>
            <Input
              id={`${id}-name`}
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              required
            />
          </Field>
          <Field label="Base URL" id={`${id}-url`}>
            <Input
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
          <EffortField id={`${id}-effort`} value={draft.reasoningEffort} dispatch={dispatch} />
          <KeyInput form={form} id={`${id}-key`} dispatch={dispatch} />
        </CardContent>
        <FormActions busy={busy} dispatch={dispatch} test={form.probe.test} onTest={onTest} />
      </form>
    </Card>
  );
};
