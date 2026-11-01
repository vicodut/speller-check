import { createFrameScheduler } from "../../shared/frame-scheduler.util";
import type { WatchedField } from "../../shared/issue-view";
import { badgePosition, type FieldBox } from "./badge-position.util";
import { BADGE_CSS } from "./status-badge.styles";

const fieldBox = (field: WatchedField): FieldBox => {
  const rect = field.getBoundingClientRect();
  const style = getComputedStyle(field);
  const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
  const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
  const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
  const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    borderRight,
    borderBottom,
    scrollbarX: Math.max(0, field.offsetWidth - field.clientWidth - borderLeft - borderRight),
    scrollbarY: Math.max(0, field.offsetHeight - field.clientHeight - borderTop - borderBottom),
  };
};

/** A spinner in the focused field's bottom-right corner while its text is being checked. */
export class StatusBadge {
  private readonly host = document.createElement("gc-status");
  private readonly badge = document.createElement("div");
  private readonly frame = createFrameScheduler(() => this.place());
  private readonly resize = new ResizeObserver(() => this.frame.schedule());
  private readonly onMove = () => this.frame.schedule();
  private field: WatchedField | null = null;

  constructor() {
    this.host.style.setProperty("all", "initial");
    const shadow = this.host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = BADGE_CSS;
    this.badge.className = "gc-badge";
    this.badge.hidden = true;
    shadow.append(style, this.badge);
    document.documentElement.appendChild(this.host);
  }

  showLoading(field: WatchedField): void {
    if (this.field !== field) {
      this.detach();
      this.field = field;
      this.resize.observe(field);
      window.addEventListener("scroll", this.onMove, { passive: true, capture: true });
      window.addEventListener("resize", this.onMove, { passive: true });
    }
    this.place();
    this.badge.hidden = false;
  }

  hide(field?: WatchedField): void {
    if (field && field !== this.field) return;
    this.detach();
    this.badge.hidden = true;
  }

  dispose(): void {
    this.hide();
    this.resize.disconnect();
    this.host.remove();
  }

  private place(): void {
    if (!this.field) return;
    const { left, top } = badgePosition(fieldBox(this.field));
    this.badge.style.left = `${left}px`;
    this.badge.style.top = `${top}px`;
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
