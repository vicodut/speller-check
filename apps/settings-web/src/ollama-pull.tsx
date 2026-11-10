import type { OllamaPullView } from "@gc/protocol";
import { CircleAlert, Download, X } from "lucide-react";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { Progress } from "./components/ui/progress";
import { StatusDot } from "./components/ui/status-dot";
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
  <div className="flex flex-col gap-2">
    <p className="m-0">
      Pulling <code className="font-mono text-xs">{pull.model}</code>
    </p>
    <div className="flex items-center gap-3">
      <Progress
        aria-label={`Pulling ${pull.model}`}
        max={pull.total || undefined}
        value={pull.step === "downloading" ? pull.completed : undefined}
      />
      <Button variant="outline" size="sm" disabled={busy} onClick={onCancel}>
        <X aria-hidden="true" /> Cancel
      </Button>
    </div>
    <p className="m-0 text-xs text-muted-foreground tabular-nums" aria-live="polite">
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
        <p className="m-0 flex items-center gap-2">
          <StatusDot tone="ok" /> Pulled <code className="font-mono text-xs">{pull.model}</code>.
        </p>
      )}
      {failed && (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>
            <p className="m-0">
              Couldn't pull {failed.model}: {PULL_ERROR[failed.error ?? ""] ?? "it failed."} (
              <code className="font-mono text-xs">{failed.error}</code>)
            </p>
          </AlertDescription>
        </Alert>
      )}
      {missing && (
        <p className="m-0 flex flex-wrap items-center gap-2">
          <code className="font-mono text-xs">{missing}</code> isn't pulled yet.
          <Button size="sm" disabled={busy} onClick={() => onPull(missing)}>
            <Download aria-hidden="true" />
            {failed?.model === missing ? "Try again" : `Pull ${missing}`}
          </Button>
        </p>
      )}
    </>
  );
};
