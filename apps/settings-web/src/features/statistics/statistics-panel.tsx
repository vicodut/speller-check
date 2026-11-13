import type { StatisticsCell, StatisticsRow, StatisticsView } from "@gc/protocol";
import { Card, CardContent, CardHeader, CardTitle } from "@gc/ui";
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

/** Statistics: how fast each profile's model checks text per letter, and how often it fails. */
export const StatisticsPanel = ({ token }: { token: string }) => {
  const result = useStatistics(token);
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
      </CardContent>
    </Card>
  );
};
