import type { FeatureModel } from "@gc/protocol";
import {
  Badge,
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
  StatusDot,
  type StatusTone,
} from "@gc/ui";
import { Cloud, HardDrive } from "lucide-react";
import type { ConnectionStatus } from "../../../shared/port-messages";

const LABELS: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  ready: "Connected",
  auth_failed: "Token missing or rejected",
  unverified: "Core not verified",
  unreachable: "Core not reachable",
};

const TONES: Record<ConnectionStatus, StatusTone> = {
  connecting: "busy",
  ready: "ok",
  auth_failed: "off",
  unverified: "off",
  unreachable: "off",
};

type Props = { status: ConnectionStatus | undefined; check: FeatureModel | undefined };

/** The core connection: a status dot and label, and the check model with a local/cloud badge. */
export const ConnectionCard = ({ status, check }: Props) => (
  <Card className="gap-0 py-5">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-sm" role="status">
        <StatusDot tone={status ? TONES[status] : "off"} />
        {status ? LABELS[status] : "Unknown"}
      </CardTitle>
      <CardDescription className="truncate">
        {check ? `Model: ${check.model}` : "The model shows once the core is connected."}
      </CardDescription>
      {check && (
        <CardAction>
          <Badge variant={check.local ? "success" : "warning"}>
            {check.local ? <HardDrive /> : <Cloud />}
            {check.local ? "Local" : "Cloud"}
          </Badge>
        </CardAction>
      )}
    </CardHeader>
  </Card>
);
