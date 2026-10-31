import type { Issue } from "@gc/protocol";

export type WatchedField = HTMLTextAreaElement | HTMLInputElement;

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
