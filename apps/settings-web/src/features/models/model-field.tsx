import { RotateCw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { probeErrorText } from "../../lib/probe-text.util";
import type { ModelsState } from "../../lib/profile-probe.reducer";

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
    <div className="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-start sm:gap-4">
      <Label htmlFor={id} className="text-muted-foreground sm:h-9">
        Model
      </Label>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Input
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
        <p
          className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <span className={models.phase === "failed" ? "text-warning" : undefined}>
            {status(models)}
          </span>
          <Button
            variant="link"
            size="sm"
            className="h-auto gap-1 p-0 text-xs has-[>svg]:px-0 [&_svg]:size-3"
            disabled={models.phase === "loading"}
            onClick={onReload}
          >
            <RotateCw aria-hidden="true" /> Reload list
          </Button>
        </p>
      </div>
    </div>
  );
};
