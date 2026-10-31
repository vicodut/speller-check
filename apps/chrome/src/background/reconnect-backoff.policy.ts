export const BACKOFF_BASE_MS = 500;
export const BACKOFF_CAP_MS = 30_000;

/** Delay before reconnect attempt `attempt` (0-based): doubles from `baseMs`, capped at `capMs`. */
export const reconnectDelay = (
  attempt: number,
  baseMs: number = BACKOFF_BASE_MS,
  capMs: number = BACKOFF_CAP_MS,
): number => {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  // Clamp the exponent so 2 ** n stays finite for very large attempt counts.
  return Math.min(capMs, baseMs * 2 ** Math.min(safeAttempt, 30));
};
