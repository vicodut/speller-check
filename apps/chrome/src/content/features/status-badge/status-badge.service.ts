import type { Issue } from "@gc/protocol";
import { createFrameScheduler } from "../../shared/frame-scheduler.util";
import type { WatchedField } from "../../shared/issue-view";
import { badgePosition, type FieldBox, panelPlacement } from "./badge-position.util";
import { type BadgeState, badgeLabel } from "./badge-state.util";
import { renderIssueList } from "./issue-list.view";
import { BADGE_CSS } from "./status-badge.styles";

export type StatusBadgeCallbacks = {
  /** The user picked an issue from the badge's list. */
  select(field: WatchedField, issue: Issue): void;
};

const fieldBox = (field: WatchedField): FieldBox => {
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

/** Keeps the field focused when the badge or its list is clicked (a blur would close the field). */
const keepFocus = (el: HTMLElement) => el.addEventListener("mousedown", (e) => e.preventDefault());

/**
 * The focused field's corner badge: a spinner while checking, then the issue count (click for
 * the list), a failed check, or an unreachable core.
 */
export class StatusBadge {
  private readonly host = document.createElement("gc-status");
  private readonly badge = document.createElement("div");
  private readonly panel = document.createElement("div");
  private readonly frame = createFrameScheduler(() => this.place());
  private readonly resize = new ResizeObserver(() => this.frame.schedule());
  private readonly onMove = () => this.frame.schedule();
  private field: WatchedField | null = null;
  private state: BadgeState | null = null;
  /** The view's latest visible issues for the field, shown once the check is done. */
  private latest: readonly Issue[] = [];

  constructor(private readonly callbacks: StatusBadgeCallbacks) {
    this.host.style.setProperty("all", "initial");
    const shadow = this.host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = BADGE_CSS;
    this.badge.hidden = true;
    this.panel.className = "gc-panel";
    this.panel.hidden = true;
    keepFocus(this.badge);
    keepFocus(this.panel);
    this.badge.addEventListener("click", () => this.togglePanel());
    shadow.append(style, this.badge, this.panel);
    document.documentElement.appendChild(this.host);
  }

  checking(field: WatchedField): void {
    if (this.field !== field) this.latest = [];
    this.attach(field);
    this.set({ kind: "checking" });
  }

  /** The view's visible issues changed; a done check shows them right away. */
  issues(field: WatchedField, issues: readonly Issue[]): void {
    if (field !== this.field) return;
    this.latest = issues;
    if (this.state?.kind === "count") this.set({ kind: "count", issues });
  }

  /** A result for the field's current text arrived. */
  done(field: WatchedField): void {
    if (field === this.field) this.set({ kind: "count", issues: this.latest });
  }

  failed(field: WatchedField, code: string): void {
    if (field === this.field) this.set({ kind: "failed", code });
  }

  /** The core can't be used; shown on the field the badge is on, if any. */
  offline(status: "auth_failed" | "unreachable", field?: WatchedField): void {
    if (field) this.attach(field);
    if (this.field) this.set({ kind: "offline", status });
  }

  hide(field?: WatchedField): void {
    if (field && field !== this.field) return;
    this.detach();
    this.state = null;
    this.badge.hidden = true;
    this.closePanel();
  }

  dispose(): void {
    this.hide();
    this.resize.disconnect();
    this.host.remove();
  }

  private set(state: BadgeState): void {
    this.state = state;
    const { text, title, variant } = badgeLabel(state);
    this.badge.className = `gc-badge gc-${variant}`;
    this.badge.textContent = text;
    this.badge.title = title;
    this.badge.hidden = false;
    if (variant !== "issues") this.closePanel();
    else if (!this.panel.hidden) this.renderPanel();
    this.place();
  }

  private togglePanel(): void {
    if (!this.panel.hidden) {
      this.closePanel();
      return;
    }
    if (this.state?.kind !== "count" || this.state.issues.length === 0) return;
    this.panel.hidden = false;
    this.renderPanel();
    this.place();
    // Capture phase, so page handlers that stop propagation can't keep the list open.
    document.addEventListener("mousedown", this.onOutsideClick, true);
    document.addEventListener("keydown", this.onEscape, true);
  }

  private closePanel(): void {
    if (this.panel.hidden) return;
    this.panel.hidden = true;
    document.removeEventListener("mousedown", this.onOutsideClick, true);
    document.removeEventListener("keydown", this.onEscape, true);
  }

  /** Clicks inside the closed shadow root are retargeted to the host, so they keep it open. */
  private readonly onOutsideClick = (event: MouseEvent) => {
    if (!event.composedPath().includes(this.host)) this.closePanel();
  };

  private readonly onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.closePanel();
  };

  private renderPanel(): void {
    const field = this.field;
    if (!field) return;
    renderIssueList(this.panel, this.latest, (issue) => {
      this.closePanel();
      this.callbacks.select(field, issue);
    });
  }

  private place(): void {
    if (!this.field) return;
    const position = badgePosition(fieldBox(this.field));
    this.badge.style.left = `${position.left}px`;
    this.badge.style.top = `${position.top}px`;
    if (this.panel.hidden) return;
    const viewport = { width: innerWidth, height: innerHeight };
    const spot = panelPlacement(position, viewport, this.panel.offsetHeight);
    this.panel.style.right = `${spot.right}px`;
    this.panel.style.top = spot.top === undefined ? "" : `${spot.top}px`;
    this.panel.style.bottom = spot.bottom === undefined ? "" : `${spot.bottom}px`;
  }

  private attach(field: WatchedField): void {
    if (this.field === field) return;
    this.detach();
    this.field = field;
    this.resize.observe(field);
    window.addEventListener("scroll", this.onMove, { passive: true, capture: true });
    window.addEventListener("resize", this.onMove, { passive: true });
  }

  private detach(): void {
    if (!this.field) return;
    this.resize.unobserve(this.field);
    window.removeEventListener("scroll", this.onMove, { capture: true });
    window.removeEventListener("resize", this.onMove);
    this.frame.cancel();
    this.field = null;
  }
}
