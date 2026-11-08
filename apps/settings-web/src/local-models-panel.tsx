import type { LocalModelView } from "@gc/protocol";
import { useLocalModels } from "./local-models.hook";
import { downloadLabel, isDownloading, ramWarningText, scoreText } from "./local-models.util";
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

type Actions = Pick<ReturnType<typeof useLocalModels>, "onDownload" | "onCancel" | "onDelete">;

const Controls = ({
  model,
  busy,
  ...actions
}: { model: LocalModelView; busy: boolean } & Actions) => {
  if (isDownloading(model)) {
    return (
      <div className="pull">
        <div className="pull-row">
          <progress
            aria-label={`Downloading ${model.name}`}
            max={model.sizeBytes}
            value={model.state === "downloading" ? model.completed : undefined}
          />
          <button type="button" disabled={busy} onClick={() => actions.onCancel(model.id)}>
            Cancel
          </button>
        </div>
        <p className="hint" aria-live="polite">
          {downloadLabel(model)}
        </p>
      </div>
    );
  }
  if (model.state === "ready") {
    return (
      <p>
        <span className="dot ok" /> On disk, verified{" "}
        <button
          type="button"
          disabled={busy || model.inUse}
          title={model.inUse ? "A profile uses this model" : undefined}
          onClick={() => actions.onDelete(model.id)}
        >
          Delete
        </button>
        {model.inUse && <span className="hint"> · in use by a profile</span>}
      </p>
    );
  }
  const resume = model.completed > 0 ? ` (${formatBytes(model.completed)} already here)` : "";
  return (
    <p>
      <button type="button" disabled={busy} onClick={() => actions.onDownload(model.id)}>
        {model.state === "failed" ? "Try again" : model.completed > 0 ? "Resume" : "Download"}
      </button>
      <span className="hint">{resume}</span>
    </p>
  );
};

const Entry = ({
  model,
  memoryBytes,
  ...rest
}: { model: LocalModelView; memoryBytes: number; busy: boolean } & Actions) => {
  const warning = ramWarningText(model, memoryBytes);
  return (
    <li className="local-model">
      <strong>{model.name}</strong>
      <span className="hint">
        {" "}
        · {formatBytes(model.sizeBytes)} ·{" "}
        {model.kind === "server" ? "runs the models" : scoreText(model)}
      </span>
      {warning && (
        <p className="notice" role="alert">
          {warning}
        </p>
      )}
      {model.state === "failed" && (
        <p className="notice" role="alert">
          {ERRORS[model.error ?? ""] ?? "The download failed."} (<code>{model.error}</code>)
        </p>
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
    <section aria-label="Local models" className="ollama">
      <h2>Local models</h2>
      <p className="hint">
        Downloaded to your Mac and checked against a checksum before use. Your text never leaves it.
      </p>
      {error && (
        <p className="notice" role="alert">
          {ERRORS[error] ?? "That didn't work."} (<code>{error}</code>)
        </p>
      )}
      <ul className="local-models">
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
    </section>
  );
};
