import type { RephraseTone } from "@gc/protocol";
import type { RephrasePanelState } from "./rephrase.controller";
import type { RephraseRow, RephraseVersionView } from "./rephrase-view.model";
import type { ToneButtonView } from "./tone-picker.model";

/** What the section's buttons do; wired by the session. */
export type RephraseSectionActions = {
  /** Asks for one tone of the passage (added to the result already shown, if any). */
  rephrase(tone: RephraseTone): void;
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

const TONE_TITLES = {
  available: "Rewrite the paragraph at the caret in this tone",
  loading: "This tone is on its way",
  done: "This tone is shown below",
} as const;

/** One button per tone: a done or loading tone can't be asked again. */
const toneRow = (
  tones: readonly ToneButtonView[],
  enabled: boolean,
  rephrase: (tone: RephraseTone) => void,
): HTMLElement => {
  const row = el("div", "gc-tone-picker");
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", "Rephrase");
  for (const { tone, label, status } of tones) {
    const node = button(`gc-rephrase gc-tone-${status}`, label, () => rephrase(tone));
    node.disabled = !enabled || status !== "available";
    node.title = enabled ? TONE_TITLES[status] : "Put the caret inside a sentence to rephrase it";
    if (status === "loading") node.setAttribute("aria-busy", "true");
    if (status === "done") node.setAttribute("aria-pressed", "true");
    row.append(node);
  }
  return row;
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
    node.append(button("gc-btn gc-btn-link gc-replace", "Replace", () => replace(row.segment)));
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
    head.append(
      button("gc-btn gc-btn-link gc-replace", "Replace all", () => actions.replace(version.tone)),
    );
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
  const copyButton = button("gc-btn gc-btn-link gc-replace", "Copy", async () => {
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
 * The panel's rephrase section: the tone buttons, then the versions received so far (with
 * Replace and Replace all) followed by a loading line per tone still to come. Text only.
 * `sentTo`: the host the text goes to, set only while the rephrase model is a cloud one.
 */
export const renderRephraseSection = (
  container: HTMLElement,
  state: RephrasePanelState,
  actions: RephraseSectionActions,
  sentTo?: string,
): void => {
  const section = el("div", "gc-rephrase-section");
  const enabled = state.kind === "result" || state.enabled;
  section.append(el("div", "gc-section-label", "Rephrase"));
  section.append(toneRow(state.tones, enabled, actions.rephrase));
  if (sentTo !== undefined) section.append(el("div", "gc-sent-to", `Sent to ${sentTo}`));
  if (state.kind === "result") {
    if (state.copy !== undefined) section.append(copyFallback(state.copy, actions.copy));
    section.append(...state.versions.map((v) => versionBlock(v, actions)));
    section.append(...pendingLines(state.pending));
  }
  container.replaceChildren(section);
};
