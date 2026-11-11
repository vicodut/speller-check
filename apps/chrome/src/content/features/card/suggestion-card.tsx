import type { Issue, IssueType } from "@gc/protocol";
import { ArrowRight, BookPlus, Check, Copy, X } from "lucide-react";
import { useState } from "react";
import { colourForType } from "../../shared/issue-colour.util";

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

const KIND_LABELS: Record<IssueType, string> = {
  spelling: "Spelling",
  grammar: "Grammar",
  punctuation: "Punctuation",
  syntax: "Syntax",
};

const CopyButton = ({ onCopy, primary }: { onCopy(): Promise<boolean>; primary: boolean }) => {
  const [label, setLabel] = useState("Copy");
  const copy = async () => setLabel((await onCopy()) ? "Copied" : "Copy failed");
  const icon = label === "Copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />;
  if (primary) {
    return (
      <button type="button" className="gc-btn gc-btn-primary" onClick={copy}>
        {icon}
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="gc-btn gc-btn-ghost gc-btn-icon"
      title={label}
      aria-label={label}
      onClick={copy}
    >
      {icon}
    </button>
  );
};

const Actions = (props: SuggestionCardProps) => (
  <div className="gc-actions">
    <button type="button" className="gc-btn gc-btn-primary" onClick={props.onAccept}>
      <Check aria-hidden="true" />
      Accept
    </button>
    <button type="button" className="gc-btn gc-btn-outline" onClick={props.onDismiss}>
      <X aria-hidden="true" />
      Dismiss
    </button>
    <div className="gc-actions-end">
      {props.showAddToDictionary && (
        <button
          type="button"
          className="gc-btn gc-btn-ghost gc-btn-icon"
          title="Add to dictionary"
          aria-label="Add to dictionary"
          onClick={props.onAddToDictionary}
        >
          <BookPlus aria-hidden="true" />
        </button>
      )}
      <CopyButton onCopy={props.onCopy} primary={false} />
    </div>
  </div>
);

/** The suggestion card: the issue kind, original → suggestion, the reason, and the actions. */
export const SuggestionCard = (props: SuggestionCardProps) => {
  const { issue } = props;
  return (
    <div className={`gc-card gc-surface gc-${issue.type}`} role="dialog" aria-label="Suggestion">
      <div className="gc-kind">
        <span className="gc-kind-dot" style={{ background: colourForType(issue.type) }} />
        {KIND_LABELS[issue.type]}
      </div>
      <div className="gc-change">
        <span className="gc-original">{issue.original}</span>
        <span className="gc-arrow" aria-hidden="true">
          <ArrowRight />
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
