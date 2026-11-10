import type { LocalModelView } from "@gc/protocol";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { type Actions, Controls } from "./local-model-controls";
import { useLocalModels } from "./local-models.hook";
import { ramWarningText, scoreText } from "./local-models.util";
import { formatBytes } from "./pull-progress.util";

/** Why a download or delete failed, by error code; the code itself is shown too. */
const ERRORS: Record<string, string> = {
  checksum_mismatch: "The file didn't match its checksum, so it was deleted. Try again.",
  download_failed: "The download was interrupted. Try again to resume.",
  model_in_use: "A profile uses this model. Switch that profile first.",
  download_in_progress: "Another download is running.",
  model_file_failed: "The file couldn't be deleted.",
  unreachable: "The core isn't answering.",
};

const ErrorAlert = ({ children }: { children: React.ReactNode }) => (
  <Alert variant="destructive" role="alert">
    <CircleAlert aria-hidden="true" />
    <AlertDescription>
      <p className="m-0">{children}</p>
    </AlertDescription>
  </Alert>
);

const Entry = ({
  model,
  memoryBytes,
  ...rest
}: { model: LocalModelView; memoryBytes: number; busy: boolean } & Actions) => {
  const warning = ramWarningText(model, memoryBytes);
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <p className="m-0">
        <span className="font-medium">{model.name}</span>
        <span className="text-muted-foreground">
          {" "}
          · {formatBytes(model.sizeBytes)} ·{" "}
          {model.kind === "server" ? "runs the models" : scoreText(model)}
        </span>
      </p>
      {warning && (
        <Alert variant="warning" role="alert">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      )}
      {model.state === "failed" && (
        <ErrorAlert>
          {ERRORS[model.error ?? ""] ?? "The download failed."} (
          <code className="font-mono text-xs">{model.error}</code>)
        </ErrorAlert>
      )}
      <Controls model={model} {...rest} />
    </li>
  );
};

/**
 * The models Grammar Checker can download and run on this Mac (shipped list, nothing fetched
 * from a server): size, memory needed and score, a progress bar with Cancel and resume, and
 * Delete once verified.
 */
export const LocalModelsPanel = ({ token }: { token: string | null }) => {
  const { view, error, busy, ...actions } = useLocalModels(token);
  if (!view) return null;
  return (
    <Card aria-label="Local models">
      <CardHeader>
        <CardTitle className="m-0 text-base">Local models</CardTitle>
        <CardDescription className="m-0">
          Downloaded to your Mac and checked against a checksum before use. Your text never leaves
          it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <ErrorAlert>
            {ERRORS[error] ?? "That didn't work."} (
            <code className="font-mono text-xs">{error}</code>)
          </ErrorAlert>
        )}
        <ul className="m-0 list-none divide-y divide-border p-0">
          {view.models.map((model) => (
            <Entry
              key={model.id}
              model={model}
              memoryBytes={view.memoryBytes}
              busy={busy}
              {...actions}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
