import type { Issue } from "@gc/protocol";

/** A textarea or text input. */
export type TextControl = HTMLTextAreaElement | HTMLInputElement;

/** A text control, or the root element of a contenteditable region (see `field-text.ts`). */
export type WatchedField = TextControl | HTMLElement;

export type IssueViewCallbacks = {
  /** The user chose "Add to dictionary" for a term. */
  addToDictionary(term: string): void;
  /** The issues drawn on `field` changed (after dismissals, dictionary adds and stale ones). */
  visibleChanged(field: WatchedField, issues: readonly Issue[]): void;
};

/** Draws issues for one field at a time and handles the card. Implemented by the underlines/card features. */
export type IssueView = {
  show(field: WatchedField, issues: readonly Issue[]): void;
  /** Opens the card for one of the field's visible issues (e.g. picked from the badge list). */
  open(field: WatchedField, issue: Issue): void;
  clear(field: WatchedField): void;
  dispose(): void;
};

export type CreateIssueView = (callbacks: IssueViewCallbacks) => IssueView;
