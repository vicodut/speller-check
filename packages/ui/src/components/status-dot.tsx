import { cn } from "./cn.util";

export type StatusTone = "ok" | "busy" | "off";

const TONE: Record<StatusTone, string> = {
  ok: "bg-success",
  busy: "bg-warning",
  off: "bg-muted-foreground",
};

type Props = { tone: StatusTone; className?: string | undefined };

/** A small coloured dot before a status line. Decorative: the text next to it says the status. */
export const StatusDot = ({ tone, className }: Props) => (
  <span
    aria-hidden="true"
    data-slot="status-dot"
    className={cn("inline-block size-2 shrink-0 rounded-full", TONE[tone], className)}
  />
);
