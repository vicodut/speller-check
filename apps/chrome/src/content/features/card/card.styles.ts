import { UI_BASE_CSS } from "../../shared/ui.styles";
import { CARD_WIDTH } from "./card-layout.util";

export const CARD_CSS = `${UI_BASE_CSS}
.gc-card {
  width: max-content;
  min-width: 220px;
  max-width: ${CARD_WIDTH}px;
  padding: 10px 12px 12px;
}
.gc-kind {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  color: var(--gc-muted-foreground);
  font-size: 11px;
  font-weight: 500;
}
.gc-kind-dot { width: 6px; height: 6px; border-radius: 50%; }
.gc-change { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 14px; }
.gc-original {
  color: var(--gc-destructive);
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--gc-destructive) 60%, transparent);
  word-break: break-word;
}
.gc-arrow { display: flex; color: var(--gc-muted-foreground); }
.gc-arrow svg { width: 14px; height: 14px; }
.gc-suggestion {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--gc-success-background);
  color: var(--gc-success);
  font-weight: 600;
  word-break: break-word;
}
.gc-reason {
  margin-top: 6px;
  color: var(--gc-muted-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gc-note {
  margin-top: 8px;
  padding: 6px 8px;
  border: 1px solid color-mix(in srgb, var(--gc-warning) 50%, transparent);
  border-radius: 8px;
  background: var(--gc-warning-background);
  color: var(--gc-warning);
  font-size: 12px;
}
.gc-actions { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
.gc-actions-end { display: flex; gap: 2px; margin-left: auto; }
`;
