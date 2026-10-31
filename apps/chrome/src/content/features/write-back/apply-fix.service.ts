import type { Issue } from "@gc/protocol";
import type { WatchedField } from "../../shared/issue-view";
import { expectedTextAfterFix, matchesText } from "./fix-text.util";

const runEdit = (suggestion: string): boolean =>
  suggestion === ""
    ? document.execCommand("delete", false)
    : document.execCommand("insertText", false, suggestion);

/**
 * Replaces the issue's range with its suggestion through the browser's editing pipeline,
 * so native beforeinput/input events fire and undo keeps working. Never assigns `.value`.
 * Returns false when the field no longer holds the original or the edit didn't land.
 */
export const applyFix = (field: WatchedField, issue: Issue): boolean => {
  const before = field.value;
  if (!matchesText(before, issue)) return false;
  try {
    field.focus();
    field.setSelectionRange(issue.start, issue.end);
    if (!runEdit(issue.suggestion)) return false;
  } catch {
    return false;
  }
  return field.value === expectedTextAfterFix(before, issue);
};
