import type { RuntimeView } from "@gc/protocol";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, StatusDot } from "@gc/ui";
import { Check, Play } from "lucide-react";
import { OllamaPull } from "./ollama-pull";

const LINE = "m-0 flex flex-wrap items-center gap-x-2 gap-y-1";

type Props = {
  ollama: RuntimeView["ollama"];
  /** The model the active profile asks Ollama for. */
  model: string | null;
  busy: boolean;
  onStart: () => void;
  onPull: (model: string) => void;
  onCancelPull: () => void;
};

/** Ollama lists `qwen3` as `qwen3:latest`. */
const sameModel = (a: string, b: string) =>
  (a.includes(":") ? a : `${a}:latest`) === (b.includes(":") ? b : `${b}:latest`);

const Status = ({ ollama, busy, onStart }: Pick<Props, "ollama" | "busy" | "onStart">) => {
  switch (ollama.state) {
    case "running":
      return (
        <p className={LINE}>
          <StatusDot tone="ok" /> Running{ollama.version && ` · v${ollama.version}`}
          <span className="text-muted-foreground">
            {ollama.startedByApp
              ? " · started by Grammar Checker, stopped when you switch to a cloud profile"
              : " · your own Ollama, left running"}
          </span>
        </p>
      );
    case "starting":
      return (
        <p className={LINE}>
          <StatusDot tone="busy" /> Starting Ollama…
        </p>
      );
    case "not_installed":
      return (
        <p className={LINE}>
          <StatusDot tone="off" /> Ollama isn't installed. Get it from{" "}
          <a
            href="https://ollama.com/download"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-4"
          >
            ollama.com
          </a>
          , or pick a cloud profile.
        </p>
      );
    default:
      return (
        <p className={LINE}>
          <StatusDot tone="off" />
          {ollama.state === "failed" ? "Ollama didn't start within 30 s." : "Ollama isn't running."}
          <Button variant="outline" size="sm" disabled={busy} onClick={onStart}>
            <Play aria-hidden="true" /> Start Ollama
          </Button>
        </p>
      );
  }
};

/** The models Ollama has, the profile's one marked. */
const PulledModels = ({ models, model }: { models: readonly string[]; model: string | null }) => (
  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
    {models.map((m) => {
      const current = model !== null && sameModel(m, model);
      return (
        <li key={m}>
          <Badge variant={current ? "success" : "outline"} className="font-mono">
            {current && <Check aria-hidden="true" />}
            {m}
          </Badge>
        </li>
      );
    })}
    {models.length === 0 && (
      <li>
        <Badge variant="outline" className="border-dashed text-muted-foreground">
          No models pulled yet
        </Badge>
      </li>
    )}
  </ul>
);

/** The local runtime behind the active profile: its state and the models it has. */
export const OllamaPanel = ({ ollama, model, busy, onStart, onPull, onCancelPull }: Props) => {
  const missing =
    ollama.state === "running" && model && !ollama.models.some((m) => sameModel(m, model))
      ? model
      : null;
  return (
    <Card aria-label="Ollama">
      <CardHeader>
        <CardTitle className="m-0 text-base">Ollama</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Status ollama={ollama} busy={busy} onStart={onStart} />
        {ollama.state === "running" && <PulledModels models={ollama.models} model={model} />}
        {ollama.state === "running" && (
          <OllamaPull
            pull={ollama.pull}
            missing={missing}
            busy={busy}
            onPull={onPull}
            onCancel={onCancelPull}
          />
        )}
      </CardContent>
    </Card>
  );
};
