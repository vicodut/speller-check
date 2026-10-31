import { createRoot } from "react-dom/client";
import { CARD_CSS } from "./card.styles";
import { SuggestionCard, type SuggestionCardProps } from "./suggestion-card";

export type CardRenderer = {
  /** Renders (or re-renders) the card with these props. */
  render(props: SuggestionCardProps): void;
  /** Empties the card without unmounting React. */
  hide(): void;
  dispose(): void;
};

/** Mounts a React root for the card inside `slot` (which lives in the overlay's shadow root). */
export const createCardRenderer = (slot: HTMLElement): CardRenderer => {
  const style = document.createElement("style");
  style.textContent = CARD_CSS;
  const mount = document.createElement("div");
  slot.append(style, mount);
  // Keep focus in the field: a click on the card must not blur it before the action runs.
  slot.addEventListener("mousedown", (event) => event.preventDefault());
  const root = createRoot(mount);
  return {
    render(props) {
      // A new key per issue resets local state such as the "Copied" label.
      const key = `${props.issue.start}:${props.issue.original}:${props.fallback}`;
      root.render(<SuggestionCard key={key} {...props} />);
    },
    hide() {
      root.render(null);
    },
    dispose() {
      root.unmount();
      style.remove();
      mount.remove();
    },
  };
};
