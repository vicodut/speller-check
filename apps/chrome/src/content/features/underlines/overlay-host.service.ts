import { OVERLAY_CSS } from "./overlay.styles";

/** The injected UI: one host element with a closed shadow root holding everything we draw. */
export type OverlayHost = {
  /** Retargeted event target for anything inside the overlay (used to spot clicks on the card). */
  host: HTMLElement;
  /** Holds underline segments; cleared on every redraw. */
  underlines: HTMLDivElement;
  /** Scratch area for mirror divs. */
  scratch: HTMLDivElement;
  /** Where the card is rendered. */
  cardSlot: HTMLDivElement;
  remove(): void;
};

const div = (parent: Node, className: string): HTMLDivElement => {
  const el = document.createElement("div");
  el.className = className;
  parent.appendChild(el);
  return el;
};

export const createOverlayHost = (): OverlayHost => {
  const host = document.createElement("gc-overlay");
  host.style.setProperty("all", "initial");
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = OVERLAY_CSS;
  shadow.appendChild(style);
  const root = div(shadow, "gc-root");
  const overlay: OverlayHost = {
    host,
    underlines: div(root, "gc-underlines"),
    scratch: div(root, "gc-scratch"),
    cardSlot: div(root, "gc-card-slot"),
    remove: () => host.remove(),
  };
  overlay.cardSlot.hidden = true;
  document.documentElement.appendChild(host);
  return overlay;
};
