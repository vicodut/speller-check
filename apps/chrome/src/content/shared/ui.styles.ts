import { SHADOW_THEME_CSS } from "@gc/ui/shadow-theme";

/**
 * Base styles for every injected shadow root: the shared palette on :host (generated from
 * @gc/ui), a floating surface and the button variants, matching the shadcn look of the pages.
 * Plain CSS, no Tailwind: its @property rules don't apply inside a shadow root.
 */
export const UI_BASE_CSS = `${SHADOW_THEME_CSS}
:host {
  --gc-ring: color-mix(in srgb, var(--gc-primary) 50%, transparent);
  --gc-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --gc-font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :host { --gc-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.4); }
}
.gc-surface {
  box-sizing: border-box;
  border: 1px solid var(--gc-border);
  border-radius: 12px;
  background: var(--gc-card);
  color: var(--gc-foreground);
  box-shadow: var(--gc-shadow);
  font: var(--gc-font);
  text-align: left;
  direction: ltr;
}
.gc-btn {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  font: 500 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s, box-shadow 0.15s;
}
.gc-btn svg { width: 14px; height: 14px; flex: none; }
.gc-btn:focus-visible { box-shadow: 0 0 0 3px var(--gc-ring); }
.gc-btn:disabled { opacity: 0.5; cursor: default; }
.gc-btn-primary { background: var(--gc-primary); color: var(--gc-primary-foreground); }
.gc-btn-primary:hover { background: color-mix(in srgb, var(--gc-primary) 90%, transparent); }
.gc-btn-outline {
  border: 1px solid var(--gc-border);
  background: var(--gc-card);
  color: var(--gc-foreground);
}
.gc-btn-outline:hover, .gc-btn-ghost:hover { background: var(--gc-muted); }
.gc-btn-ghost { color: var(--gc-foreground); }
.gc-btn-icon { width: 28px; padding: 0; }
.gc-btn-link { height: 24px; padding: 0 6px; color: var(--gc-primary); }
.gc-btn-link:hover { background: color-mix(in srgb, var(--gc-primary) 10%, transparent); }
@media (prefers-reduced-motion: reduce) { .gc-btn { transition: none; } }
`;
