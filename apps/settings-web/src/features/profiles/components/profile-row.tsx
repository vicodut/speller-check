import type { ProfileView } from "@gc/protocol";
import { Alert, AlertDescription, Badge, Button } from "@gc/ui";
import { Cloud, KeyRound, Laptop, Pencil, Trash2, TriangleAlert } from "lucide-react";

const host = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

type ConfirmProps = { question: string; onYes: () => void; onNo: () => void };

/** Asked before deleting a profile in use: its uses move to Local, which can't be deleted. */
export const ConfirmMove = ({ question, onYes, onNo }: ConfirmProps) => (
  <Alert variant="warning" role="alert" className="mt-2 basis-full">
    <TriangleAlert aria-hidden="true" />
    <AlertDescription className="gap-3">
      <p className="m-0 text-foreground">{question}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" size="sm" onClick={onYes}>
          Switch to Local and delete
        </Button>
        <Button variant="outline" size="sm" onClick={onNo}>
          Cancel
        </Button>
      </div>
    </AlertDescription>
  </Alert>
);

/** Whether the profile's text stays on this Mac, as a badge. */
export const KindBadge = ({ local }: { local: boolean }) => (
  <Badge variant={local ? "success" : "warning"}>
    {local ? <Laptop aria-hidden="true" /> : <Cloud aria-hidden="true" />}
    {local ? "local" : "cloud"}
  </Badge>
);

type RowProps = {
  profile: ProfileView;
  active: boolean;
  locked: boolean;
  busy: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/** One saved profile: a radio to make it the one in use, its kind and model, Edit and Delete. */
export const ProfileRow = ({ profile: p, active, locked, busy, ...on }: RowProps) => (
  <>
    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
      <input
        type="radio"
        name="active-profile"
        className="size-4 shrink-0 cursor-pointer accent-primary"
        checked={active}
        disabled={busy || locked}
        onChange={on.onActivate}
      />
      <span className="font-medium">{p.name}</span>
      <KindBadge local={p.local} />
      <span className="truncate font-mono text-xs text-muted-foreground">{p.model}</span>
      {p.hasKey && (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <KeyRound aria-hidden="true" className="size-3" /> key saved
        </span>
      )}
    </label>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={on.onEdit}>
        <Pencil aria-hidden="true" /> Edit
      </Button>
      {!p.builtIn && (
        <Button variant="outline" size="sm" disabled={busy || locked} onClick={on.onDelete}>
          <Trash2 aria-hidden="true" /> Delete
        </Button>
      )}
    </div>
    {!p.local && (
      <p className="m-0 basis-full pl-7 text-xs text-warning">
        Your text is sent to {host(p.baseUrl)}
      </p>
    )}
  </>
);
