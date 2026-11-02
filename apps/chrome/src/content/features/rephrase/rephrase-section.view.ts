import type { RephrasePanelState } from "./rephrase.controller";
import type { RephraseVersionView } from "./rephrase-view.model";

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = "",
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

const rephraseButton = (enabled: boolean, rephrase: () => void): HTMLButtonElement => {
  const button = el("button", "gc-rephrase", "Rephrase");
  button.type = "button";
  button.disabled = !enabled;
  button.title = enabled
    ? "Rewrite the paragraph at the caret in four tones"
    : "Put the caret inside a sentence to rephrase it";
  button.addEventListener("click", rephrase);
  return button;
};

const versionBlock = (version: RephraseVersionView): HTMLElement => {
  const block = el("div", "gc-version");
  block.append(el("div", "gc-tone", version.label));
  for (const row of version.rows) {
    if (row.kind === "rewritten") {
      block.append(el("div", "gc-rewrite", row.text));
      continue;
    }
    const kept = el("div", "gc-unchanged", row.text);
    kept.append(el("span", "gc-unchanged-tag", "unchanged"));
    block.append(kept);
  }
  if (version.fits) block.append(el("div", "gc-fits", "Already fits this tone"));
  return block;
};

/** One loading line per tone still to come; the first one is announced. */
const pendingLines = (labels: readonly string[]): HTMLElement[] =>
  labels.map((label, i) => {
    const line = el("div", "gc-rephrase-loading", `${label}…`);
    if (i === 0) line.setAttribute("role", "status");
    return line;
  });

/**
 * The panel's rephrase section: the button, or the versions received so far followed by a
 * loading line per tone still to come. Text only.
 */
export const renderRephraseSection = (
  container: HTMLElement,
  state: RephrasePanelState,
  rephrase: () => void,
): void => {
  const section = el("div", "gc-rephrase-section");
  if (state.kind === "idle") section.append(rephraseButton(state.enabled, rephrase));
  else section.append(...state.versions.map(versionBlock), ...pendingLines(state.pending));
  container.replaceChildren(section);
};
