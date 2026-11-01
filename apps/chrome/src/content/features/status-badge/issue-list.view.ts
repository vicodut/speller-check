import type { Issue } from "@gc/protocol";
import { colourForType } from "../../shared/issue-colour.util";

const span = (className: string, text: string): HTMLSpanElement => {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  return el;
};

/** One row per issue: type colour, original → suggestion. Text only, never parsed as HTML. */
export const renderIssueList = (
  container: HTMLElement,
  issues: readonly Issue[],
  select: (issue: Issue) => void,
): void => {
  const rows = issues.map((issue) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "gc-item";
    row.title = issue.reason;
    const dot = span("gc-dot", "");
    dot.style.background = colourForType(issue.type);
    row.append(
      dot,
      span("gc-original", issue.original),
      span("", "→"),
      span("gc-suggestion", issue.suggestion === "" ? "(remove)" : issue.suggestion),
    );
    row.addEventListener("click", () => select(issue));
    return row;
  });
  container.replaceChildren(...rows);
};
