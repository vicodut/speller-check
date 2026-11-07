import type { OllamaPullView } from "@gc/protocol";
import { isPulling, pullLabel } from "./pull-progress.util";

type Props = {
  /** The latest pull, if any. */
  pull: OllamaPullView | null;
  /** The profile's model when Ollama doesn't have it; null when nothing is missing. */
  missing: string | null;
  busy: boolean;
  onPull: (model: string) => void;
  onCancel: () => void;
};

/** Why a pull failed, by error code; the code itself is shown too. */
const PULL_ERROR: Record<string, string> = {
  ollama_model_not_found: "Ollama has no model by that name. Check it on ollama.com/library.",
  ollama_pull_failed: "Ollama couldn't download it. Check the network and free disk space.",
  ollama_unreachable: "Ollama stopped answering during the download.",
};

const Running = ({
  pull,
  busy,
  onCancel,
}: { pull: OllamaPullView } & Pick<Props, "busy" | "onCancel">) => (
  <div className="pull">
    <p>
      Pulling <code>{pull.model}</code>
    </p>
    <div className="pull-row">
      <progress
        aria-label={`Pulling ${pull.model}`}
        max={pull.total || undefined}
        value={pull.step === "downloading" ? pull.completed : undefined}
      />
      <button type="button" disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
    <p className="hint" aria-live="polite">
      {pullLabel(pull)}
    </p>
  </div>
);

/**
 * Pulling the profile's model when Ollama doesn't have it: a Pull button, then a progress bar
 * with Cancel, then the outcome. The page polls the runtime while a pull runs.
 */
export const OllamaPull = ({ pull, missing, busy, onPull, onCancel }: Props) => {
  if (pull && isPulling(pull)) return <Running pull={pull} busy={busy} onCancel={onCancel} />;
  const failed = pull?.step === "failed" ? pull : null;
  return (
    <>
      {pull?.step === "done" && (
        <p>
          <span className="dot ok" /> Pulled <code>{pull.model}</code>.
        </p>
      )}
      {failed && (
        <p className="notice" role="alert">
          Couldn't pull {failed.model}: {PULL_ERROR[failed.error ?? ""] ?? "it failed."} (
          <code>{failed.error}</code>)
        </p>
      )}
      {missing && (
        <p className="pull-offer">
          <code>{missing}</code> isn't pulled yet.{" "}
          <button type="button" disabled={busy} onClick={() => onPull(missing)}>
            {failed?.model === missing ? "Try again" : `Pull ${missing}`}
          </button>
        </p>
      )}
    </>
  );
};
