import type { Issue } from "@gc/protocol";
import { createFrameScheduler } from "../../shared/frame-scheduler.util";
import type { WatchedField } from "../../shared/issue-view";
import { BadgePanel, type BadgePanelCallbacks } from "./badge-panel.service";
import { badgePosition, type FieldBox, panelPlacement } from "./badge-position.util";
import { type BadgeState, badgeLabel, resultState, withRephraseReady } from "./badge-state.util";
import { BADGE_CSS } from "./status-badge.styles";

export type StatusBadgeCallbacks = BadgePanelCallbacks;

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

/** Variants whose badge opens the panel: a done check, with or without issues. */
const PANEL_VARIANTS = new Set(["issues", "clean"]);

/**
 * The focused field's corner badge: a spinner while checking, then the issue count (click for
 * the panel), a failed check, a field too long to check, or an unreachable core.
 */
export class StatusBadge {
  private readonly host = document.createElement("gc-status");
  private readonly badge = document.createElement("div");
  private readonly panel: BadgePanel;
  private readonly section: StatusBadgeCallbacks["section"];
  private readonly frame = createFrameScheduler(() => this.place());
  private readonly resize = new ResizeObserver(() => this.frame.schedule());
  private readonly onMove = () => this.frame.schedule();
  private field: WatchedField | null = null;
  private state: BadgeState | null = null;
  /** The view's latest visible issues for the field, shown once the check is done. */
  private latest: readonly Issue[] = [];

  constructor(callbacks: StatusBadgeCallbacks) {
    this.section = callbacks.section;
    this.panel = new BadgePanel(this.host, callbacks);
    this.host.style.setProperty("all", "initial");
    const shadow = this.host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = BADGE_CSS + (callbacks.section?.css ?? "");
    this.badge.hidden = true;
    keepFocus(this.badge);
    keepFocus(this.panel.el);
    this.badge.addEventListener("click", () => this.togglePanel());
    shadow.append(style, this.badge, this.panel.el);
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

  /** A result for the field's current text arrived; a `pending` one keeps the spinner. */
  done(field: WatchedField, pending?: boolean): void {
    if (field === this.field) this.set(resultState(this.latest, pending));
  }

  /** The field's text is over the cap: nothing was sent, its issues are gone. */
  tooLong(field: WatchedField): void {
    this.latest = [];
    this.attach(field);
    this.set({ kind: "too_long" });
  }

  /** A late failure of a check sent before the field went over the cap doesn't replace it. */
  failed(field: WatchedField, code: string): void {
    if (field !== this.field || this.state?.kind === "too_long") return;
    this.set({ kind: "failed", code });
  }

  /** The core can't be used; shown on the field the badge is on, if any. */
  offline(status: "auth_failed" | "unreachable", field?: WatchedField): void {
    if (field) this.attach(field);
    if (this.field) this.set({ kind: "offline", status });
  }

  /** The panel's section changed (e.g. a rephrase tone arrived): re-render it if open. */
  refreshPanel(field: WatchedField): void {
    this.panel.refresh(field);
    this.paint();
    this.place();
  }

  hide(field?: WatchedField): void {
    if (field && field !== this.field) return;
    this.detach();
    this.state = null;
    this.badge.hidden = true;
    this.panel.close();
  }

  dispose(): void {
    this.hide();
    this.resize.disconnect();
    this.host.remove();
  }

  private set(state: BadgeState): void {
    this.state = state;
    this.badge.hidden = false;
    if (!PANEL_VARIANTS.has(badgeLabel(state).variant)) this.panel.close();
    else if (this.field) this.panel.refresh(this.field, this.latest);
    this.paint();
    this.place();
  }

  /** Draws the state, plus the "rephrase ready" marker while the section has unseen news. */
  private paint(): void {
    if (!this.state) return;
    const ready = !!this.field && !!this.section?.hasNews(this.field);
    const { text, title, variant } = withRephraseReady(badgeLabel(this.state), ready);
    this.badge.className = `gc-badge gc-${variant}${ready ? " gc-ready" : ""}`;
    this.badge.textContent = text;
    this.badge.title = title;
  }

  private togglePanel(): void {
    if (this.panel.isOpen) {
      this.panel.close();
      return;
    }
    if (this.state?.kind !== "count" || !this.field) return;
    if (!this.panel.open(this.field, this.state.issues)) return;
    this.paint();
    this.place();
  }

  private place(): void {
    if (!this.field) return;
    const position = badgePosition(fieldBox(this.field));
    this.badge.style.left = `${position.left}px`;
    this.badge.style.top = `${position.top}px`;
    if (!this.panel.isOpen) return;
    const viewport = { width: innerWidth, height: innerHeight };
    const spot = panelPlacement(position, viewport, this.panel.el.offsetHeight);
    const style = this.panel.el.style;
    style.right = `${spot.right}px`;
    style.top = spot.top === undefined ? "" : `${spot.top}px`;
    style.bottom = spot.bottom === undefined ? "" : `${spot.bottom}px`;
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
