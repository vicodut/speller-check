import type { LocalModelView } from "@gc/protocol";
import { Download, RotateCw, Trash2, X } from "lucide-react";
import { Button } from "./components/ui/button";
import { Progress } from "./components/ui/progress";
import { StatusDot } from "./components/ui/status-dot";
import type { useLocalModels } from "./local-models.hook";
import { downloadLabel, isDownloading } from "./local-models.util";
import { formatBytes } from "./pull-progress.util";

export type Actions = Pick<
  ReturnType<typeof useLocalModels>,
  "onDownload" | "onCancel" | "onDelete"
>;

type Props = { model: LocalModelView; busy: boolean } & Actions;

const Downloading = ({ model, busy, onCancel }: Props) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-3">
      <Progress
        aria-label={`Downloading ${model.name}`}
        max={model.sizeBytes}
        value={model.state === "downloading" ? model.completed : undefined}
      />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onCancel(model.id)}>
        <X aria-hidden="true" /> Cancel
      </Button>
    </div>
    <p className="m-0 text-xs text-muted-foreground tabular-nums" aria-live="polite">
      {downloadLabel(model)}
    </p>
  </div>
);

const Ready = ({ model, busy, onDelete }: Props) => (
  <p className="m-0 flex flex-wrap items-center gap-2">
    <StatusDot tone="ok" /> On disk, verified
    <Button
      variant="outline"
      size="sm"
      disabled={busy || model.inUse}
      title={model.inUse ? "A profile uses this model" : undefined}
      onClick={() => onDelete(model.id)}
    >
      <Trash2 aria-hidden="true" /> Delete
    </Button>
    {model.inUse && <span className="text-muted-foreground">in use by a profile</span>}
  </p>
);

const Offer = ({ model, busy, onDownload }: Props) => {
  const failed = model.state === "failed";
  const resume = model.completed > 0 ? ` (${formatBytes(model.completed)} already here)` : "";
  return (
    <p className="m-0 flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onDownload(model.id)}>
        {failed ? <RotateCw aria-hidden="true" /> : <Download aria-hidden="true" />}
        {failed ? "Try again" : model.completed > 0 ? "Resume" : "Download"}
      </Button>
      <span className="text-muted-foreground">{resume}</span>
    </p>
  );
};

/** What can be done with one model now: download (or resume), watch and cancel, or delete. */
export const Controls = (props: Props) => {
  if (isDownloading(props.model)) return <Downloading {...props} />;
  if (props.model.state === "ready") return <Ready {...props} />;
  return <Offer {...props} />;
};
