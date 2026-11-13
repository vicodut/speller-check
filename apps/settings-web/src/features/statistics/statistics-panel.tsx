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
  formatMsPerLetter,
  hasNoTimedCalls,
  hasSamples,
  placeTag,
} from "./statistics.util";

const Cell = ({ label, cell }: { label: string; cell: StatisticsCell }) => (
  <td className="px-2 py-2 align-top">
    <span className="sr-only">{label}: </span>
    {hasSamples(cell) ? (
      <>
        <span
          className={cell.msPerLetter === null ? "text-muted-foreground italic" : "font-medium"}
        >
          {formatMsPerLetter(cell.msPerLetter)}
        </span>
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
      <span className="block">{row.profileName}</span>
      <span className="block font-mono text-xs text-muted-foreground">
        {placeTag(row.local)} · {row.model}
      </span>
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
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const confirmClear = async () => {
    setClearing(true);
    setClearError(null);
    const next = await clear();
    setClearing(false);
    setConfirming(false);
    if (!next.ok) setClearError(next.error);
  };

  return (
    <Card aria-label="Statistics">
      <CardHeader>
        <CardTitle className="m-0 text-base">Statistics</CardTitle>
        <p className="m-0 text-muted-foreground">
          Median time per letter of each model call, with its ok and failed counts. Numbers only; no
          text is kept.
        </p>
      </CardHeader>
      <CardContent>
        {result === null && <p className="m-0 text-muted-foreground">Loading…</p>}
        {result?.ok && <Body view={result.value} />}
        {result && !result.ok && <p className="m-0 text-destructive">{errorText(result.error)}</p>}
        {clearError !== null && <p className="m-0 text-destructive">{errorText(clearError)}</p>}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {confirming ? (
          <ConfirmReset
            busy={clearing}
            onYes={() => void confirmClear()}
            onNo={() => setConfirming(false)}
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={result === null || clearing}
            onClick={() => {
              setClearError(null);
              setConfirming(true);
            }}
          >
            Reset statistics
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
