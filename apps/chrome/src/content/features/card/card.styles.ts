import { CARD_WIDTH } from "./card-layout.util";

export const CARD_CSS = `
.gc-card {
  --gc-bg: #ffffff;
  --gc-fg: #1c2024;
  --gc-muted: #60646c;
  --gc-border: #e0e1e6;
  --gc-btn: #f0f0f3;
  --gc-btn-hover: #e8e8ec;
  --gc-accent: #3e63dd;
  --gc-accent-fg: #ffffff;
  --gc-strike: #ce2c31;
  box-sizing: border-box;
  width: max-content;
  min-width: 200px;
  max-width: ${CARD_WIDTH}px;
  padding: 10px 12px;
  border: 1px solid var(--gc-border);
  border-radius: 10px;
  background: var(--gc-bg);
  color: var(--gc-fg);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
  font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
  text-align: left;
  direction: ltr;
}
@media (prefers-color-scheme: dark) {
  .gc-card {
    --gc-bg: #18191b;
    --gc-fg: #edeef0;
    --gc-muted: #b0b4ba;
    --gc-border: #363a3f;
    --gc-btn: #272a2d;
    --gc-btn-hover: #2e3135;
    --gc-accent: #5472e4;
    --gc-strike: #ff9592;
  }
}
.gc-change { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; font-size: 14px; }
.gc-original { color: var(--gc-strike); text-decoration: line-through; word-break: break-word; }
.gc-arrow { color: var(--gc-muted); }
.gc-suggestion { font-weight: 600; word-break: break-word; }
.gc-reason {
  margin-top: 4px;
  color: var(--gc-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gc-note { margin-top: 6px; color: var(--gc-muted); font-size: 12px; }
.gc-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.gc-btn {
  all: unset;
  box-sizing: border-box;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--gc-btn);
  color: var(--gc-fg);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.gc-btn:hover { background: var(--gc-btn-hover); }
.gc-btn:focus-visible { outline: 2px solid var(--gc-accent); outline-offset: 1px; }
.gc-btn.gc-primary { background: var(--gc-accent); color: var(--gc-accent-fg); }
.gc-btn.gc-primary:hover { filter: brightness(1.08); }
`;
