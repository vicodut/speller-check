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

/** The panel's rephrase section: the button, a loading line, or read-only versions. Text only. */
export const renderRephraseSection = (
  container: HTMLElement,
  state: RephrasePanelState,
  rephrase: () => void,
): void => {
  const section = el("div", "gc-rephrase-section");
  if (state.kind === "idle") section.append(rephraseButton(state.enabled, rephrase));
  else if (state.kind === "loading") {
    const loading = el("div", "gc-rephrase-loading", "Rephrasing…");
    loading.setAttribute("role", "status");
    section.append(loading);
  } else section.append(...state.versions.map(versionBlock));
  container.replaceChildren(section);
};
