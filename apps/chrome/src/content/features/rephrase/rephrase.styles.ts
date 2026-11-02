/** Styles for the rephrase section; injected into the badge panel's shadow root. */
export const REPHRASE_CSS = `
.gc-rephrase-section { padding: 4px; }

.gc-rephrase {
  all: unset;
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border-radius: 6px;
  font-weight: 600;
  color: #3e63dd;
  cursor: pointer;
}
.gc-rephrase:hover, .gc-rephrase:focus-visible { background: rgba(62, 99, 221, 0.1); }
.gc-rephrase:disabled { color: #8b8d98; cursor: default; background: none; }
.gc-rephrase-loading { padding: 6px 8px; color: #60646c; font-size: 12px; }
.gc-version + .gc-rephrase-loading { border-top: 1px solid rgba(0, 0, 0, 0.06); }
.gc-version { padding: 6px 8px; }
.gc-version + .gc-version { border-top: 1px solid rgba(0, 0, 0, 0.06); }
.gc-tone { font-weight: 700; font-size: 12px; margin-bottom: 4px; }
.gc-rewrite, .gc-unchanged { overflow-wrap: anywhere; margin-bottom: 4px; }
.gc-unchanged { opacity: 0.5; }
.gc-unchanged-tag { margin-left: 6px; font-size: 11px; font-style: italic; }
.gc-fits { font-size: 12px; color: #30a46c; }
@media (prefers-color-scheme: dark) {
  .gc-version + .gc-version { border-color: rgba(255, 255, 255, 0.1); }
  .gc-rephrase { color: #9eb1ff; }
  .gc-rephrase-loading { color: #b0b4ba; }
}
`;
