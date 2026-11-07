import { probeErrorText } from "./probe-text.util";
import type { ModelsState } from "./profile-probe.reducer";

type Props = {
  id: string;
  value: string;
  models: ModelsState;
  onChange: (value: string) => void;
  onReload: () => void;
};

const status = (models: ModelsState): string => {
  switch (models.phase) {
    case "idle":
      return "Models are listed from the endpoint.";
    case "loading":
      return "Listing models…";
    case "loaded":
      return models.models.length === 1
        ? "1 model from the endpoint. Type to search, or enter any name."
        : `${models.models.length} models from the endpoint. Type to search, or enter any name.`;
    case "failed":
      return `Couldn't list models (${probeErrorText(models.error, models.status)}). Type the name instead.`;
  }
};

/**
 * The model name: free text, with the endpoint's models as searchable suggestions (the
 * browser filters hundreds of them as you type). The list never blocks typing a name.
 */
export const ModelField = ({ id, value, models, onChange, onReload }: Props) => {
  const listId = `${id}-models`;
  return (
    <div className="field model-field">
      <label htmlFor={id}>Model</label>
      <div className="model-picker">
        <input
          id={id}
          value={value}
          list={models.phase === "loaded" ? listId : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search the list or type a name"
          onChange={(e) => onChange(e.target.value)}
          required
        />
        {models.phase === "loaded" && (
          <datalist id={listId}>
            {models.models.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        )}
        <p className={`model-status ${models.phase}`} aria-live="polite">
          <span>{status(models)}</span>
          <button
            type="button"
            className="link"
            disabled={models.phase === "loading"}
            onClick={onReload}
          >
            Reload list
          </button>
        </p>
      </div>
    </div>
  );
};
