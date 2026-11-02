import type { Issue } from "@gc/protocol";
import type { WatchedField } from "../../shared/issue-view";
import { renderIssueList } from "./issue-list.view";

/** Extra content below the issue list (the rephrase section), wired by the session. */
export type PanelSection = {
  readonly css: string;
  /** Renders the section; called only while the panel is open for `field`. */
  render(container: HTMLElement, field: WatchedField): void;
  /** Whether the section has something the writer hasn't seen: the badge shows a marker. */
  hasNews(field: WatchedField): boolean;
};

export type BadgePanelCallbacks = {
  select(field: WatchedField, issue: Issue): void;
  section?: PanelSection;
};

/** The badge's panel: the issue list plus an optional section. Closes on outside click or Escape. */
export class BadgePanel {
  readonly el = document.createElement("div");
  private readonly list = document.createElement("div");
  private readonly extra = document.createElement("div");
  private field: WatchedField | null = null;
  private issues: readonly Issue[] = [];

  constructor(
    private readonly host: HTMLElement,
    private readonly callbacks: BadgePanelCallbacks,
  ) {
    this.el.className = "gc-panel";
    this.el.hidden = true;
    this.list.className = "gc-list";
    this.extra.className = "gc-extra";
    this.el.append(this.list, this.extra);
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  /** Opens only when there is something to show. Returns whether it opened. */
  open(field: WatchedField, issues: readonly Issue[]): boolean {
    if (issues.length === 0 && !this.callbacks.section) return false;
    this.field = field;
    this.issues = issues;
    this.el.hidden = false;
    this.render();
    // Capture phase, so page handlers that stop propagation can't keep the panel open.
    document.addEventListener("mousedown", this.onOutsideClick, true);
    document.addEventListener("keydown", this.onEscape, true);
    return true;
  }

  /** Re-renders an open panel for `field`, with new issues if given. */
  refresh(field: WatchedField, issues?: readonly Issue[]): void {
    if (!this.isOpen || field !== this.field) return;
    if (issues) this.issues = issues;
    this.render();
  }

  close(): void {
    if (!this.isOpen) return;
    this.el.hidden = true;
    this.field = null;
    document.removeEventListener("mousedown", this.onOutsideClick, true);
    document.removeEventListener("keydown", this.onEscape, true);
  }

  /** Clicks inside the closed shadow root are retargeted to the host, so they keep it open. */
  private readonly onOutsideClick = (event: MouseEvent) => {
    if (!event.composedPath().includes(this.host)) this.close();
  };

  private readonly onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.close();
  };

  private render(): void {
    const field = this.field;
    if (!field) return;
    renderIssueList(this.list, this.issues, (issue) => {
      this.close();
      this.callbacks.select(field, issue);
    });
    this.list.hidden = this.issues.length === 0;
    if (this.callbacks.section) this.callbacks.section.render(this.extra, field);
  }
}
