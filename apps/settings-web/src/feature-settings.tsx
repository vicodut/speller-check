import type { FeatureSettingsView } from "@gc/protocol";
import { Badge, type BadgeVariants, Card, CardContent, CardHeader, CardTitle } from "@gc/ui";

type Origin = { source: string; envVar?: string | undefined };

const TONE: Record<string, BadgeVariants["variant"]> = {
  env: "warning",
  saved: "success",
};

const Source = ({ origin }: { origin: Origin }) => (
  <Badge variant={TONE[origin.source] ?? "secondary"} className="justify-self-end font-mono">
    {origin.envVar ?? origin.source}
  </Badge>
);

const Row = ({ label, value, origin }: { label: string; value: string | null; origin: Origin }) => (
  <>
    <dt className="text-muted-foreground">{label}</dt>
    <dd
      className={
        value === null
          ? "m-0 text-muted-foreground italic"
          : "m-0 font-mono text-xs [overflow-wrap:anywhere]"
      }
    >
      {value ?? "not set"}
    </dd>
    <Source origin={origin} />
  </>
);

/** One feature's settings in effect, each with where its value comes from. */
export const FeatureSettings = ({ title, view }: { title: string; view: FeatureSettingsView }) => (
  <Card aria-label={title}>
    <CardHeader>
      <CardTitle className="m-0 text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <dl className="m-0 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[max-content_1fr_auto] [&>dt]:col-span-2 [&>dt]:mt-2 sm:[&>dt]:col-span-1 sm:[&>dt]:mt-0">
        <Row label="Base URL" value={view.baseUrl.value} origin={view.baseUrl} />
        <Row label="Model" value={view.model.value} origin={view.model} />
        <Row
          label="Reasoning effort"
          value={view.reasoningEffort.value}
          origin={view.reasoningEffort}
        />
        <Row label="API key" value={view.apiKey.set ? "saved" : null} origin={view.apiKey} />
      </dl>
    </CardContent>
  </Card>
);
