import type { TextControl, WatchedField } from "./issue-view";
import { buildTextModel, offsetOf, pointAt, type TextModel } from "./text-model";

export const isTextControl = (field: WatchedField): field is TextControl =>
  field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement;

const model = (field: HTMLElement): TextModel<Node> => buildTextModel<Node>(field);

/** The field's full text: `value` for controls, the text model for contenteditable. */
export const fieldText = (field: WatchedField): string =>
  isTextControl(field) ? field.value : model(field).text;

/** The collapsed caret's text offset, or null when there's a selection or no caret here. */
export const fieldCaret = (field: WatchedField): number | null => {
  if (isTextControl(field)) {
    const { selectionStart, selectionEnd } = field;
    return selectionStart !== null && selectionStart === selectionEnd ? selectionStart : null;
  }
  const selection = field.ownerDocument.getSelection();
  if (!selection?.isCollapsed || !selection.anchorNode) return null;
  if (!field.contains(selection.anchorNode)) return null;
  return offsetOf(model(field), selection.anchorNode, selection.anchorOffset);
};

/** A DOM Range over [start, end) of a contenteditable field; null if it can't be mapped. */
export const editableRange = (field: HTMLElement, start: number, end: number): Range | null => {
  const textModel = model(field);
  const from = pointAt(textModel, start, "start");
  const to = pointAt(textModel, end, "end");
  if (!from || !to) return null;
  const range = field.ownerDocument.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  return range;
};

/** The outermost contenteditable element containing `target`, or undefined. */
export const editableRoot = (target: EventTarget | null | undefined): HTMLElement | undefined => {
  if (!(target instanceof HTMLElement) || !target.isContentEditable) return undefined;
  let root = target;
  while (root.parentElement?.isContentEditable) root = root.parentElement;
  return root;
};
