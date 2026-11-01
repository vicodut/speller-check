import type { Issue } from "@gc/protocol";

/** A textarea or text input. */
export type TextControl = HTMLTextAreaElement | HTMLInputElement;

/** A text control, or the root element of a contenteditable region (see `field-text.ts`). */
export type WatchedField = TextControl | HTMLElement;

export type IssueViewCallbacks = {
  /** The user chose "Add to dictionary" for a term. */
  addToDictionary(term: string): void;
};

/** Draws issues for one field at a time and handles the card. Implemented by the underlines/card features. */
export type IssueView = {
  show(field: WatchedField, issues: readonly Issue[]): void;
  clear(field: WatchedField): void;
  dispose(): void;
};

export type CreateIssueView = (callbacks: IssueViewCallbacks) => IssueView;
