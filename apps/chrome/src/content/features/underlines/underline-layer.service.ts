import type { Rect } from "./rect.util";

export type UnderlineSegment = { rect: Rect; colour: string };

const THICKNESS = 3;

/** Replaces the container's content with one wavy segment under each rect. */
export const drawUnderlines = (container: HTMLElement, segments: readonly UnderlineSegment[]) => {
  const nodes = segments.map(({ rect, colour }) => {
    const el = document.createElement("div");
    el.className = "gc-underline";
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top + rect.height - THICKNESS}px`;
    el.style.width = `${rect.width}px`;
    el.style.backgroundColor = colour;
    return el;
  });
  container.replaceChildren(...nodes);
};
