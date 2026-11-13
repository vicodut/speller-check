import type { StatisticsCell, StatisticsRow, StatisticsView } from "@gc/protocol";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@gc/ui";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { errorText } from "../../lib/error-text.util";
import { useStatistics } from "./statistics.hook";
import {
  cellCounts,
  EMPTY_STATISTICS_TEXT,
  formatMsPer,
  hasNoTimedCalls,
  hasSamples,
  placeTag,
  rowTotals,
} from "./statistics.util";
import { IDLE_RESET, type ResetEvent, type ResetState, resetStep } from "./statistics-reset.util";

/** One median line: muted and italic while there are not enough samples for it. */
const Median = ({ text, value }: { text: string; value: number | null }) => (
  <span className={value === null ? "block text-muted-foreground italic" : "block font-medium"}>
    {text}
  </span>
);

const Cell = ({ label, cell }: { label: string; cell: StatisticsCell }) => (
  <td className="px-2 py-2 align-top">
    <span className="sr-only">{label}: </span>
    {hasSamples(cell) ? (
      <>
        <Median text={formatMsPer(cell.msPerLetter, "letter")} value={cell.msPerLetter} />
        <Median text={formatMsPer(cell.msPerWord, "word")} value={cell.msPerWord} />
        <span className="block text-xs text-muted-foreground">{cellCounts(cell)}</span>
      </>
    ) : (
      <span className="text-muted-foreground italic">No samples</span>
    )}
  </td>
);

const Row = ({ row }: { row: StatisticsRow }) => (
  <tr className="border-t border-border">
    <th scope="row" className="px-2 py-2 text-left align-top font-normal">
      <span className="block">
        {row.profileName}
        {row.deleted && <span className="ml-2 text-xs text-muted-foreground">(deleted)</span>}
      </span>
      <span className="block font-mono text-xs text-muted-foreground">
        {placeTag(row.local)} · {row.model}
      </span>
      <span className="block text-xs text-muted-foreground">Total: {rowTotals(row)}</span>
    </th>
    <Cell label="Corrections" cell={row.check} />
    <Cell label="Rephrase" cell={row.rephrase} />
  </tr>
);

const Body = ({ view }: { view: StatisticsView }) =>
  hasNoTimedCalls(view) ? (
    <p className="m-0 text-muted-foreground">{EMPTY_STATISTICS_TEXT}</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Model speed and failures per profile and model</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="px-2 py-1 font-normal">
              Profile and model
            </th>
            <th scope="col" className="px-2 py-1 font-normal">
              Corrections
            </th>
            <th scope="col" className="px-2 py-1 font-normal">
              Rephrase
            </th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => (
            <Row key={`${row.profileId}|${row.model}`} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );

/** The Reset button's confirmation: nothing is cleared until "Clear all" is pressed. */
const ConfirmReset = ({
  onYes,
  onNo,
  busy,
}: {
  onYes: () => void;
  onNo: () => void;
  busy: boolean;
}) => (
  <Alert variant="warning" role="alert" className="basis-full">
    <TriangleAlert aria-hidden="true" />
    <AlertDescription className="gap-3">
      <p className="m-0 text-foreground">
        Clear every statistic, including those of removed profiles? This cannot be undone.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" size="sm" disabled={busy} onClick={onYes}>
          Clear all statistics
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={onNo}>
          Cancel
        </Button>
      </div>
    </AlertDescription>
  </Alert>
);

/** Statistics: how fast each profile's model checks text per letter, and how often it fails. */
export const StatisticsPanel = ({ token }: { token: string }) => {
  const { result, clear } = useStatistics(token);
  const [flow, setFlow] = useState<ResetState>(IDLE_RESET);
  const send = (event: ResetEvent) => setFlow((state) => resetStep(state, event).state);

  /** Clear all is the only step that asks the core to clear; the answer ends the confirmation. */
  const confirmClear = async () => {
    const step = resetStep(flow, { type: "confirm" });
    setFlow(step.state);
    if (!step.request) return;
    const next = await clear();
    send({ type: "cleared", error: next.ok ? null : next.error });
  };

  return (
    <Card aria-label="Statistics">
      <CardHeader>
        <CardTitle className="m-0 text-base">Statistics</CardTitle>
        <p className="m-0 text-muted-foreground">
          Median time per letter and per word of each model call, with its ok and failed counts.
          Numbers only; a deleted profile keeps its last name.
        </p>
      </CardHeader>
      <CardContent>
        {result === null && <p className="m-0 text-muted-foreground">Loading…</p>}
        {result?.ok && <Body view={result.value} />}
        {result && !result.ok && <p className="m-0 text-destructive">{errorText(result.error)}</p>}
        {flow.error !== null && <p className="m-0 text-destructive">{errorText(flow.error)}</p>}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {flow.phase !== "idle" ? (
          <ConfirmReset
            busy={flow.phase === "clearing"}
            onYes={() => void confirmClear()}
            onNo={() => send({ type: "cancel" })}
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={result === null}
            onClick={() => send({ type: "reset" })}
          >
            Reset statistics
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
