import type { CreateIssueView } from "../../shared/issue-view";
import { IssueViewService } from "./issue-view.service";

/** Underlines + suggestion card for watched textarea/input fields. */
export const createIssueView: CreateIssueView = (callbacks) => new IssueViewService(callbacks);
