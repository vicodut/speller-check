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
.gc-badge[hidden], .gc-panel[hidden] { display: none; }
.gc-checking {
  border: 2px solid rgba(62, 99, 221, 0.25);
  border-top-color: #3e63dd;
  box-shadow: none;
  pointer-events: none;
  animation: gc-spin 0.8s linear infinite;
}
.gc-clean { background: #30a46c; }
.gc-issues { background: #e5484d; cursor: pointer; }
.gc-failed { background: #f76b15; }
.gc-offline { background: #8b8d98; }
@keyframes gc-spin { to { transform: rotate(360deg); } }
@keyframes gc-pulse { 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) {
  .gc-checking { border-color: #3e63dd; animation: gc-pulse 1.6s ease-in-out infinite; }
}
.gc-panel {
  position: fixed;
  width: 260px;
  max-height: 240px;
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
.gc-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; }
.gc-original { text-decoration: line-through; opacity: 0.7; overflow-wrap: anywhere; }
.gc-suggestion { font-weight: 600; overflow-wrap: anywhere; }
@media (prefers-color-scheme: dark) {
  .gc-panel { background: #212225; color: #edeef0; }
  .gc-item:hover, .gc-item:focus-visible { background: rgba(255, 255, 255, 0.08); }
}
`;
