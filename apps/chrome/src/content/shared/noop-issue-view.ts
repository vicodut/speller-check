import type { CreateIssueView } from "./issue-view";

/** Placeholder until the underlines/card features provide the real `createIssueView`. */
export const createNoopIssueView: CreateIssueView = () => ({
  show: () => {},
  clear: () => {},
  dispose: () => {},
});
