import { BADGE_SIZE } from "./badge-position.util";
import { elapsedText } from "./badge-state.util";

/** Gap between the popup and the spinner, in px. */
const GAP = 4;

/** Repaint interval while the popup shows, fast enough for the tenths under 10 s. */
const TICK_MS = 100;

/**
 * "Checking… 2.4s" beside the spinner, only while the pointer is on it. The time counts from
 * when the version was sent, so it keeps running through partial results.
 */
export class ElapsedPopup {
  readonly el = document.createElement("div");
  private since: number | null = null;
  private hovered = false;
  private ticker: ReturnType<typeof setInterval> | undefined;

  constructor(
    badge: HTMLElement,
    private readonly now: () => number,
  ) {
    this.el.className = "gc-elapsed";
    this.el.hidden = true;
    badge.addEventListener("mouseenter", () => this.hover(true));
    badge.addEventListener("mouseleave", () => this.hover(false));
  }

  /** When the shown version started checking, or null when the badge isn't a spinner. */
  checking(since: number | null): void {
    this.since = since;
    this.render();
  }

  /** Puts the popup left of the badge at `left`/`top` (viewport px). */
  place(left: number, top: number): void {
    this.el.style.right = `${innerWidth - left + GAP}px`;
    this.el.style.top = `${top}px`;
    this.el.style.height = `${BADGE_SIZE}px`;
  }

  dispose(): void {
    this.hovered = false;
    this.checking(null);
  }

  private hover(on: boolean): void {
    this.hovered = on;
    this.render();
  }

  private render(): void {
    const shown = this.hovered && this.since !== null;
    this.el.hidden = !shown;
    if (shown && this.since !== null)
      this.el.textContent = `Checking… ${elapsedText(this.since, this.now())}`;
    if (shown && this.ticker === undefined) this.ticker = setInterval(() => this.render(), TICK_MS);
    if (!shown && this.ticker !== undefined) {
      clearInterval(this.ticker);
      this.ticker = undefined;
    }
  }
}
