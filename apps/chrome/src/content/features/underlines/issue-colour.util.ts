import type { IssueType } from "@gc/protocol";

const COLOURS: Record<IssueType, string> = {
  spelling: "#e5484d",
  grammar: "#3e63dd",
  punctuation: "#f76b15",
  syntax: "#8e4ec6",
};

/** Underline colour for an issue type: spelling red, grammar blue, punctuation orange, syntax purple. */
export const colourForType = (type: IssueType): string => COLOURS[type];
