/**
 * Styles for the rephrase section; injected into the badge panel's shadow root, after the base
 * styles (palette variables and .gc-btn variants).
 */
export const REPHRASE_CSS = `
.gc-rephrase-section { padding: 4px; }
.gc-section-label {
  padding: 4px 4px 6px;
  color: var(--gc-muted-foreground);
  font-size: 11px;
  font-weight: 500;
}

.gc-tone-picker { display: flex; flex-wrap: wrap; gap: 4px; }
.gc-rephrase {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--gc-border);
  border-radius: 999px;
  background: var(--gc-card);
  color: var(--gc-foreground);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s, box-shadow 0.15s;
}
.gc-rephrase:hover { background: var(--gc-muted); }
.gc-rephrase:focus-visible { box-shadow: 0 0 0 3px var(--gc-ring); }
.gc-rephrase:disabled { opacity: 0.5; cursor: default; background: var(--gc-card); }
.gc-rephrase.gc-tone-loading { opacity: 1; color: var(--gc-muted-foreground); }
.gc-rephrase.gc-tone-loading::after { content: "…"; }
.gc-rephrase.gc-tone-done {
  opacity: 1;
  border-color: transparent;
  background: var(--gc-success-background);
  color: var(--gc-success);
}
.gc-rephrase.gc-tone-done::after { content: " ✓"; white-space: pre; }

.gc-sent-to { margin-top: 6px; padding: 0 4px; color: var(--gc-muted-foreground); font-size: 11px; }
.gc-sent-to::before { content: "\\2601\\FE0E  "; white-space: pre; }

.gc-version {
  margin-top: 8px;
  padding: 8px;
  border: 1px solid var(--gc-border);
  border-radius: 8px;
}
.gc-version-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.gc-tone {
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--gc-muted);
  font-size: 11px;
  font-weight: 600;
}
.gc-rewrite, .gc-unchanged { overflow-wrap: anywhere; }
.gc-rewrite + .gc-rewrite, .gc-rewrite + .gc-unchanged, .gc-unchanged + .gc-rewrite,
.gc-unchanged + .gc-unchanged { margin-top: 4px; }
.gc-rewrite { display: flex; align-items: flex-start; gap: 8px; }
.gc-rewrite-text { flex: 1; min-width: 0; padding-top: 3px; }
.gc-replace { flex: none; }
.gc-unchanged { color: var(--gc-muted-foreground); }
.gc-unchanged-tag, .gc-replaced-tag { margin-left: 6px; font-size: 11px; font-style: italic; }
.gc-replaced-tag { flex: none; padding-top: 4px; color: var(--gc-success); white-space: nowrap; }
.gc-fits { margin-top: 6px; color: var(--gc-success); font-size: 12px; }

.gc-rephrase-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 6px 8px;
  color: var(--gc-muted-foreground);
  font-size: 12px;
}
.gc-rephrase-loading::before {
  content: "";
  width: 10px;
  height: 10px;
  border: 2px solid var(--gc-border);
  border-top-color: var(--gc-primary);
  border-radius: 50%;
  animation: gc-spin 0.8s linear infinite;
}

.gc-copy-fallback {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 6px 8px;
  border: 1px solid color-mix(in srgb, var(--gc-warning) 50%, transparent);
  border-radius: 8px;
  background: var(--gc-warning-background);
  color: var(--gc-warning);
  font-size: 12px;
}
.gc-copy-note { flex: 1; }
@media (prefers-reduced-motion: reduce) {
  .gc-rephrase { transition: none; }
  .gc-rephrase-loading::before { animation: gc-pulse 1.6s ease-in-out infinite; }
}
`;
