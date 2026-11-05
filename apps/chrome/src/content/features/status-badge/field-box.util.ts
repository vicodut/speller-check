import type { WatchedField } from "../../shared/issue-view";
import type { FieldBox } from "./badge-position.util";

/** Reads the field's viewport rect, right/bottom borders and scrollbar sizes. */
export const fieldBox = (field: WatchedField): FieldBox => {
  const rect = field.getBoundingClientRect();
  const style = getComputedStyle(field);
  const border = (side: string) =>
    Number.parseFloat(style.getPropertyValue(`border-${side}-width`)) || 0;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    borderRight: border("right"),
    borderBottom: border("bottom"),
    scrollbarX: Math.max(
      0,
      field.offsetWidth - field.clientWidth - border("left") - border("right"),
    ),
    scrollbarY: Math.max(
      0,
      field.offsetHeight - field.clientHeight - border("top") - border("bottom"),
    ),
  };
};
