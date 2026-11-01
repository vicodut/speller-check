import { BADGE_SIZE } from "./badge-position.util";

export const BADGE_CSS = `
:host { all: initial; }
.gc-badge {
  position: fixed;
  width: ${BADGE_SIZE}px;
  height: ${BADGE_SIZE}px;
  box-sizing: border-box;
  border-radius: 50%;
  border: 2px solid rgba(62, 99, 221, 0.25);
  border-top-color: #3e63dd;
  pointer-events: none;
  z-index: 2147483647;
  animation: gc-spin 0.8s linear infinite;
}
.gc-badge[hidden] { display: none; }
@keyframes gc-spin { to { transform: rotate(360deg); } }
@keyframes gc-pulse { 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) {
  .gc-badge { border-color: #3e63dd; animation: gc-pulse 1.6s ease-in-out infinite; }
}
`;
