/** Styles for the rephrase section; injected into the badge panel's shadow root. */
export const REPHRASE_CSS = `
.gc-rephrase-section { padding: 4px; }

.gc-tone-picker { display: flex; flex-wrap: wrap; gap: 2px; }
.gc-rephrase {
  all: unset;
  box-sizing: border-box;
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 600;
  color: #3e63dd;
  cursor: pointer;
}
.gc-rephrase:hover, .gc-rephrase:focus-visible { background: rgba(62, 99, 221, 0.1); }
.gc-rephrase:disabled { color: #8b8d98; cursor: default; background: none; }
.gc-rephrase.gc-tone-loading::after { content: "…"; }
.gc-rephrase.gc-tone-done::after { content: " ✓"; color: #30a46c; }
.gc-rephrase-loading { padding: 6px 8px; color: #60646c; font-size: 12px; }
.gc-version + .gc-rephrase-loading { border-top: 1px solid rgba(0, 0, 0, 0.06); }
.gc-version { padding: 6px 8px; }
.gc-version + .gc-version { border-top: 1px solid rgba(0, 0, 0, 0.06); }
.gc-version-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.gc-tone { font-weight: 700; font-size: 12px; }
.gc-rewrite, .gc-unchanged { overflow-wrap: anywhere; margin-bottom: 4px; }
.gc-rewrite { display: flex; align-items: flex-start; gap: 8px; }
.gc-rewrite-text { flex: 1; min-width: 0; }
.gc-unchanged { opacity: 0.5; }
.gc-unchanged-tag, .gc-replaced-tag { margin-left: 6px; font-size: 11px; font-style: italic; }
.gc-replaced-tag { color: #30a46c; white-space: nowrap; }
.gc-replace {
  all: unset;
  flex: none;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #3e63dd;
  cursor: pointer;
}
.gc-replace:hover, .gc-replace:focus-visible { background: rgba(62, 99, 221, 0.1); }
.gc-copy-fallback {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  font-size: 12px;
  color: #ad5700;
}
.gc-copy-note { flex: 1; }
.gc-sent-to { margin-top: 4px; padding: 0 4px; font-size: 11px; opacity: 0.65; }
.gc-fits { font-size: 12px; color: #30a46c; }
@media (prefers-color-scheme: dark) {
  .gc-version + .gc-version { border-color: rgba(255, 255, 255, 0.1); }
  .gc-rephrase, .gc-replace { color: #9eb1ff; }
  .gc-copy-fallback { color: #ffa057; }
  .gc-rephrase-loading { color: #b0b4ba; }
}
`;
