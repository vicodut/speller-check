import type { RephraseTone } from "@gc/protocol";
import type { RephrasePanelState } from "./rephrase.controller";
import type { RephraseRow, RephraseVersionView } from "./rephrase-view.model";

/** What the section's buttons do; wired by the session. */
export type RephraseSectionActions = {
  rephrase(): void;
  /** Replace one rewritten part (by segment index), or the whole version without one. */
  replace(tone: RephraseTone, segment?: number): void;
  /** Copies text to the clipboard; false when the browser refused. */
  copy(text: string): Promise<boolean>;
};

const FALLBACK_NOTE = "Couldn't edit this field — copy the text instead";

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

const button = (className: string, label: string, onClick: () => void): HTMLButtonElement => {
  const node = el("button", className, label);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
};

const rephraseButton = (enabled: boolean, rephrase: () => void): HTMLButtonElement => {
  const node = button("gc-rephrase", "Rephrase", rephrase);
  node.disabled = !enabled;
  node.title = enabled
    ? "Rewrite the paragraph at the caret in four tones"
    : "Put the caret inside a sentence to rephrase it";
  return node;
};

const rowNode = (row: RephraseRow, replace: (segment: number) => void): HTMLElement => {
  if (row.kind === "unchanged") {
    const kept = el("div", "gc-unchanged", row.text);
    kept.append(el("span", "gc-unchanged-tag", "unchanged"));
    return kept;
  }
  const node = el("div", "gc-rewrite");
  node.append(el("span", "gc-rewrite-text", row.text));
  if (row.replace === "available") {
    node.append(button("gc-replace", "Replace", () => replace(row.segment)));
  } else if (row.replace === "applied") {
    node.append(el("span", "gc-replaced-tag", "replaced"));
  }
  return node;
};

const versionBlock = (version: RephraseVersionView, actions: RephraseSectionActions) => {
  const block = el("div", "gc-version");
  const head = el("div", "gc-version-head");
  head.append(el("span", "gc-tone", version.label));
  if (version.replaceAll) {
    head.append(button("gc-replace", "Replace all", () => actions.replace(version.tone)));
  }
  block.append(head);
  for (const row of version.rows) {
    block.append(rowNode(row, (segment) => actions.replace(version.tone, segment)));
  }
  if (version.fits) block.append(el("div", "gc-fits", "Already fits this tone"));
  return block;
};

/** Write-back failed: the note and a Copy button for the text that couldn't be written. */
const copyFallback = (text: string, copy: (text: string) => Promise<boolean>): HTMLElement => {
  const box = el("div", "gc-copy-fallback");
  box.setAttribute("role", "status");
  const copyButton = button("gc-replace", "Copy", async () => {
    copyButton.textContent = (await copy(text)) ? "Copied" : "Copy failed";
  });
  box.append(el("span", "gc-copy-note", FALLBACK_NOTE), copyButton);
  return box;
};

/** One loading line per tone still to come; the first one is announced. */
const pendingLines = (labels: readonly string[]): HTMLElement[] =>
  labels.map((label, i) => {
    const line = el("div", "gc-rephrase-loading", `${label}…`);
    if (i === 0) line.setAttribute("role", "status");
    return line;
  });

/**
 * The panel's rephrase section: the button, or the versions received so far (with Replace and
 * Replace all) followed by a loading line per tone still to come. Text only.
 */
export const renderRephraseSection = (
  container: HTMLElement,
  state: RephrasePanelState,
  actions: RephraseSectionActions,
): void => {
  const section = el("div", "gc-rephrase-section");
  if (state.kind === "idle") {
    section.append(rephraseButton(state.enabled, actions.rephrase));
  } else {
    if (state.copy !== undefined) section.append(copyFallback(state.copy, actions.copy));
    section.append(...state.versions.map((v) => versionBlock(v, actions)));
    section.append(...pendingLines(state.pending));
  }
  container.replaceChildren(section);
};
