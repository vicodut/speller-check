import { BADGE_SIZE } from "./badge-position.util";

export const BADGE_CSS = `
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
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
.gc-badge[hidden], .gc-panel[hidden], .gc-list[hidden], .gc-elapsed[hidden] { display: none; }
.gc-elapsed {
  position: fixed;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 5px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  color: #3e63dd;
  font: 600 10px/1 system-ui, -apple-system, sans-serif;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
  z-index: 2147483647;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.gc-checking {
  border: 2px solid rgba(62, 99, 221, 0.25);
  border-top-color: #3e63dd;
  box-shadow: none;
  animation: gc-spin 0.8s linear infinite;
}
.gc-clean { background: #30a46c; cursor: pointer; }
.gc-issues { background: #e5484d; cursor: pointer; }
.gc-failed { background: #f76b15; }
.gc-offline { background: #8b8d98; }
.gc-too-long { background: #8b8d98; }
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
  background: #fff;
  color: #3e63dd;
  font: 400 9px/1 system-ui, -apple-system, sans-serif;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
}
@keyframes gc-spin { to { transform: rotate(360deg); } }
@keyframes gc-pulse { 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) {
  .gc-checking { border-color: #3e63dd; animation: gc-pulse 1.6s ease-in-out infinite; }
}
.gc-panel {
  position: fixed;
  width: 280px;
  max-height: 360px;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 4px;
  border-radius: 8px;
  background: #fff;
  color: #1c2024;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  font: 13px/1.35 system-ui, -apple-system, sans-serif;
  z-index: 2147483647;
}
.gc-item {
  all: unset;
  display: flex;
  gap: 8px;
  align-items: baseline;
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.gc-item:hover, .gc-item:focus-visible { background: rgba(0, 0, 0, 0.06); }
.gc-list:not([hidden]) + .gc-extra:not(:empty) {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  margin-top: 4px;
}
.gc-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; }
.gc-original { text-decoration: line-through; opacity: 0.7; overflow-wrap: anywhere; }
.gc-suggestion { font-weight: 600; overflow-wrap: anywhere; }
@media (prefers-color-scheme: dark) {
  .gc-panel { background: #212225; color: #edeef0; }
  .gc-elapsed { background: rgba(33, 34, 37, 0.92); color: #9eb1ff; }
  .gc-cloud::before { background: #212225; color: #9eb1ff; }
  .gc-item:hover, .gc-item:focus-visible { background: rgba(255, 255, 255, 0.08); }
  .gc-list:not([hidden]) + .gc-extra:not(:empty) { border-color: rgba(255, 255, 255, 0.1); }
}
`;
