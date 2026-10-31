import type { Issue } from "@gc/protocol";
import { useState } from "react";

export type SuggestionCardProps = {
  issue: Issue;
  showAddToDictionary: boolean;
  /** Write-back failed: offer Copy only, with a note. */
  fallback: boolean;
  onAccept(): void;
  onDismiss(): void;
  onAddToDictionary(): void;
  onCopy(): Promise<boolean>;
};

const FALLBACK_NOTE = "Couldn't edit this field — copy the fix instead";

const CopyButton = ({ onCopy, primary }: { onCopy(): Promise<boolean>; primary: boolean }) => {
  const [label, setLabel] = useState("Copy");
  const copy = async () => setLabel((await onCopy()) ? "Copied" : "Copy failed");
  return (
    <button type="button" className={primary ? "gc-btn gc-primary" : "gc-btn"} onClick={copy}>
      {label}
    </button>
  );
};

const Actions = (props: SuggestionCardProps) => (
  <div className="gc-actions">
    <button type="button" className="gc-btn gc-primary" onClick={props.onAccept}>
      Accept
    </button>
    <button type="button" className="gc-btn" onClick={props.onDismiss}>
      Dismiss
    </button>
    {props.showAddToDictionary && (
      <button type="button" className="gc-btn" onClick={props.onAddToDictionary}>
        Add to dictionary
      </button>
    )}
    <CopyButton onCopy={props.onCopy} primary={false} />
  </div>
);

/** The suggestion card: original → suggestion, the reason, and the actions. */
export const SuggestionCard = (props: SuggestionCardProps) => {
  const { issue } = props;
  return (
    <div className={`gc-card gc-${issue.type}`} role="dialog" aria-label="Suggestion">
      <div className="gc-change">
        <span className="gc-original">{issue.original}</span>
        <span className="gc-arrow" aria-hidden="true">
          →
        </span>
        <span className="gc-suggestion">{issue.suggestion || "(remove)"}</span>
      </div>
      {issue.reason && <div className="gc-reason">{issue.reason}</div>}
      {props.fallback ? (
        <>
          <div className="gc-note">{FALLBACK_NOTE}</div>
          <div className="gc-actions">
            <CopyButton onCopy={props.onCopy} primary={true} />
          </div>
        </>
      ) : (
        <Actions {...props} />
      )}
    </div>
  );
};
