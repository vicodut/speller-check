import type { Issue } from "@gc/protocol";
import { createFrameScheduler } from "../../shared/frame-scheduler.util";
import type { WatchedField } from "../../shared/issue-view";
import { BadgePanel, type BadgePanelCallbacks } from "./badge-panel.service";
import { BADGE_SIZE, badgePosition, panelPlacement } from "./badge-position.util";
import { type BadgeState, badgeLabel, resultState, withRephraseReady } from "./badge-state.util";
import { fieldBox } from "./field-box.util";
import { BADGE_CSS } from "./status-badge.styles";

export type StatusBadgeCallbacks = BadgePanelCallbacks;

/** Keeps the field focused when the badge or its list is clicked (a blur would close the field). */
const keepFocus = (el: HTMLElement) => el.addEventListener("mousedown", (e) => e.preventDefault());

/** Variants whose badge opens the panel: a done check, with or without issues. */
const PANEL_VARIANTS = new Set(["issues", "clean"]);

/** Gap between the elapsed-time label and the spinner, in px. */
const ELAPSED_GAP = 4;

/**
 * The focused field's corner badge: a spinner while checking (with the elapsed time beside it
 * after 10 s), then the issue count (click for the panel), a failed check, a field too long to
 * check, or an unreachable core.
 */
export class StatusBadge {
  private readonly host = document.createElement("gc-status");
  private readonly badge = document.createElement("div");
  private readonly elapsed = document.createElement("div");
  /** Repaints the elapsed time once a second while checking. */
  private ticker: ReturnType<typeof setInterval> | undefined;
  private readonly panel: BadgePanel;
  private readonly section: StatusBadgeCallbacks["section"];
  private readonly frame = createFrameScheduler(() => this.place());
  private readonly resize = new ResizeObserver(() => this.frame.schedule());
  private readonly onMove = () => this.frame.schedule();
  private field: WatchedField | null = null;
  private state: BadgeState | null = null;
  /** The view's latest visible issues for the field, shown once the check is done. */
  private latest: readonly Issue[] = [];

  /** `now`: the clock for elapsed times (injectable for tests). */
  constructor(
    callbacks: StatusBadgeCallbacks,
    private readonly now: () => number = Date.now,
  ) {
    this.section = callbacks.section;
    this.panel = new BadgePanel(this.host, callbacks);
    this.host.style.setProperty("all", "initial");
    const shadow = this.host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = BADGE_CSS + (callbacks.section?.css ?? "");
    this.badge.hidden = true;
    this.elapsed.className = "gc-elapsed";
    this.elapsed.hidden = true;
    keepFocus(this.badge);
    keepFocus(this.panel.el);
    this.badge.addEventListener("click", () => this.togglePanel());
    shadow.append(style, this.elapsed, this.badge, this.panel.el);
    document.documentElement.appendChild(this.host);
  }

  checking(field: WatchedField): void {
    if (this.field !== field) this.latest = [];
    this.attach(field);
    this.set({ kind: "checking", since: this.now() });
  }

  /** The view's visible issues changed; a done check shows them right away. */
  issues(field: WatchedField, issues: readonly Issue[]): void {
    if (field !== this.field) return;
    this.latest = issues;
    if (this.state?.kind === "count") this.set({ kind: "count", issues });
  }

  /** A result for the field's current text arrived; a `pending` one keeps the spinner and time. */
  done(field: WatchedField, pending?: boolean): void {
    if (field !== this.field) return;
    const since = this.state?.kind === "checking" ? this.state.since : this.now();
    this.set(resultState(this.latest, since, pending));
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
    this.elapsed.hidden = true;
    this.tick(false);
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
    this.tick(state.kind === "checking");
    if (!PANEL_VARIANTS.has(badgeLabel(state).variant)) this.panel.close();
    else if (this.field) this.panel.refresh(this.field, this.latest);
    this.paint();
    this.place();
  }

  /** Draws the state, plus the "rephrase ready" marker while the section has unseen news. */
  private paint(): void {
    if (!this.state) return;
    const ready = !!this.field && !!this.section?.hasNews(this.field);
    const label = badgeLabel(this.state, this.now());
    const { text, title, variant } = withRephraseReady(label, ready);
    this.badge.className = `gc-badge gc-${variant}${ready ? " gc-ready" : ""}`;
    this.badge.textContent = text;
    this.badge.title = title;
    this.elapsed.textContent = label.elapsed ?? "";
    this.elapsed.hidden = !label.elapsed;
  }

  /** Runs the once-a-second repaint while checking, and stops it otherwise. */
  private tick(on: boolean): void {
    if (on && this.ticker === undefined) this.ticker = setInterval(() => this.paint(), 1000);
    if (!on && this.ticker !== undefined) {
      clearInterval(this.ticker);
      this.ticker = undefined;
    }
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
    this.elapsed.style.right = `${innerWidth - position.left + ELAPSED_GAP}px`;
    this.elapsed.style.top = `${position.top}px`;
    this.elapsed.style.height = `${BADGE_SIZE}px`;
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
