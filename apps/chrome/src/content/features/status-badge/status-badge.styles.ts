import { UI_BASE_CSS } from "../../shared/ui.styles";
import { BADGE_SIZE } from "./badge-position.util";

// Badge fills stay fixed (not light/dark): they sit on any page and must read as a status.
const BADGE_RULES = `
:host { all: initial; }
.gc-badge {
  position: fixed;
  width: ${BADGE_SIZE}px;
  height: ${BADGE_SIZE}px;
  box-sizing: border-box;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 700 9px/1 system-ui, -apple-system, sans-serif;
  color: #fff;
  cursor: default;
  user-select: none;
  z-index: 2147483647;
  box-shadow: 0 0 0 1.5px rgb(255 255 255 / 0.9), 0 1px 3px rgb(0 0 0 / 0.3);
  transition: transform 0.15s;
}
.gc-badge[hidden], .gc-panel[hidden], .gc-list[hidden], .gc-elapsed[hidden] { display: none; }
.gc-clean:hover, .gc-issues:hover { transform: scale(1.12); }
.gc-elapsed {
  position: fixed;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 7px;
  border-radius: 6px;
  background: var(--gc-foreground);
  color: var(--gc-background);
  font: 500 11px/1 system-ui, -apple-system, sans-serif;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
  z-index: 2147483647;
  box-shadow: var(--gc-shadow);
}
.gc-checking {
  border: 2px solid color-mix(in srgb, #3e63dd 25%, transparent);
  border-top-color: #3e63dd;
  box-shadow: none;
  animation: gc-spin 0.8s linear infinite;
}
.gc-clean { background: #30a46c; cursor: pointer; }
.gc-issues { background: #e5484d; cursor: pointer; }
.gc-failed { background: #f76b15; }
.gc-offline, .gc-too-long { background: #8b8d98; }
.gc-ready:not(.gc-checking)::after {
  content: "";
  position: absolute;
  top: -3px;
  right: -3px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #3e63dd;
  box-shadow: 0 0 0 1.5px #fff;
}
.gc-cloud::before {
  content: "\\2601";
  position: absolute;
  bottom: -4px;
  left: -4px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gc-card);
  color: var(--gc-primary);
  font: 400 9px/1 system-ui, -apple-system, sans-serif;
  box-shadow: 0 0 0 1px var(--gc-border);
}
@keyframes gc-spin { to { transform: rotate(360deg); } }
@keyframes gc-pulse { 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) {
  .gc-badge { transition: none; }
  .gc-checking { border-color: #3e63dd; animation: gc-pulse 1.6s ease-in-out infinite; }
}
`;

const PANEL_RULES = `
.gc-panel {
  position: fixed;
  width: 300px;
  max-height: 380px;
  overflow-y: auto;
  padding: 4px;
  z-index: 2147483647;
}
.gc-item {
  all: unset;
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.gc-item:hover { background: var(--gc-muted); }
.gc-item:focus-visible { background: var(--gc-muted); box-shadow: inset 0 0 0 2px var(--gc-ring); }
.gc-list:not([hidden]) + .gc-extra:not(:empty) {
  border-top: 1px solid var(--gc-border);
  margin-top: 4px;
  padding-top: 4px;
}
.gc-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; }
.gc-original {
  color: var(--gc-muted-foreground);
  text-decoration: line-through;
  overflow-wrap: anywhere;
}
.gc-to { color: var(--gc-muted-foreground); }
.gc-suggestion { font-weight: 600; overflow-wrap: anywhere; }
`;

export const BADGE_CSS = UI_BASE_CSS + BADGE_RULES + PANEL_RULES;
