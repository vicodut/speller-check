import type { Issue } from "@gc/protocol";
import { editableRange, fieldText, isTextControl } from "../../shared/field-text";
import type { WatchedField } from "../../shared/issue-view";
import { expectedTextAfterFix, matchesText } from "./fix-text.util";

/** Rich editors may apply an edit on their next tick; wait this long before calling it failed. */
const SETTLE_MS = 50;

const runEdit = (suggestion: string): boolean =>
  suggestion === ""
    ? document.execCommand("delete", false)
    : document.execCommand("insertText", false, suggestion);

/** Selects the issue's range in the field; false if it can't be selected. */
const select = (field: WatchedField, issue: Issue): boolean => {
  field.focus();
  if (isTextControl(field)) {
    field.setSelectionRange(issue.start, issue.end);
    return true;
  }
  const range = editableRange(field, issue.start, issue.end);
  const selection = document.getSelection();
  if (!range || !selection) return false;
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
};

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

/**
 * Replaces the issue's range with its suggestion through the browser's editing pipeline,
 * so native beforeinput/input events fire and undo keeps working. Never assigns `.value`.
 * Resolves false when the field no longer holds the original or the edit didn't land.
 */
export const applyFix = async (field: WatchedField, issue: Issue): Promise<boolean> => {
  const before = fieldText(field);
  if (!matchesText(before, issue)) return false;
  try {
    if (!select(field, issue) || !runEdit(issue.suggestion)) return false;
  } catch {
    return false;
  }
  const expected = expectedTextAfterFix(before, issue);
  if (fieldText(field) === expected) return true;
  await settle();
  return fieldText(field) === expected;
};
