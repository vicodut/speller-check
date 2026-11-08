import { type Issue, MAX_TEXT_LENGTH } from "@gc/protocol";

/** What the badge shows for the focused field. "too_long": over the cap, nothing is sent. */
export type BadgeState =
  /** `since`: when this version started checking (ms, same clock as `now` in `badgeLabel`). */
  | { readonly kind: "checking"; readonly since: number }
  | { readonly kind: "count"; readonly issues: readonly Issue[] }
  | { readonly kind: "too_long" }
  | { readonly kind: "failed"; readonly code: string }
  | { readonly kind: "offline"; readonly status: "auth_failed" | "unreachable" };

export type BadgeLabel = { text: string; title: string; variant: string; cloud?: boolean };

const CAP = MAX_TEXT_LENGTH.toLocaleString("en-US");

const plural = (n: number) => (n === 1 ? "1 issue" : `${n} issues`);

/**
 * The state after a result: a `pending` one (more batches are coming) keeps the spinner and its
 * start time, so a partial count is never shown as final; the last one shows the count.
 */
export const resultState = (
  issues: readonly Issue[],
  since: number,
  pending?: boolean,
): BadgeState => (pending ? { kind: "checking", since } : { kind: "count", issues });

/** Time spent checking: "2.4s" under 10 s, then "23s", and "1m 1s" from a minute. */
export const elapsedText = (since: number, now: number): string => {
  const ms = Math.max(0, now - since);
  if (ms < 10_000) return `${(Math.floor(ms / 100) / 10).toFixed(1)}s`;
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

/**
 * Text, tooltip and style variant for a state. Counts above 9 show as "9+". A check has no
 * native tooltip: hovering the spinner opens the elapsed-time popup instead.
 */
export const badgeLabel = (state: BadgeState): BadgeLabel => {
  switch (state.kind) {
    case "checking":
      return { text: "", title: "", variant: "checking" };
    case "count": {
      const n = state.issues.length;
      if (n === 0)
        return { text: "✓", title: "No issues found: click to rephrase", variant: "clean" };
      const text = n > 9 ? "9+" : String(n);
      return { text, title: `${plural(n)}: click to list them or rephrase`, variant: "issues" };
    }
    case "too_long":
      return {
        text: "…",
        title: `Too long to check (over ${CAP} characters). Shorten it to check again.`,
        variant: "too-long",
      };
    case "failed":
      return {
        text: "!",
        title: `Check failed (${state.code}). Type again to retry.`,
        variant: "failed",
      };
    case "offline":
      return state.status === "auth_failed"
        ? {
            text: "!",
            title: "Token rejected: paste a new one in the extension options.",
            variant: "offline",
          }
        : {
            text: "!",
            title: "Can't reach the grammar checker core. Is it running?",
            variant: "offline",
          };
  }
};

/**
 * Marks a badge whose check text leaves this Mac (`provider`: the host it goes to; undefined for
 * a local model). The state, text and variant never change; a spinner keeps its empty tooltip
 * (its hover popup shows the time instead).
 */
export const withCloudMarker = (label: BadgeLabel, provider: string | undefined): BadgeLabel => {
  if (provider === undefined) return label;
  const note = `Sent to ${provider}`;
  return { ...label, cloud: true, title: label.title === "" ? "" : `${label.title} · ${note}` };
};

/**
 * Adds the "rephrase ready" line to the tooltip (the badge also gets a dot). The text, so the
 * issue count, never changes.
 */
export const withRephraseReady = (label: BadgeLabel, ready: boolean): BadgeLabel =>
  ready ? { ...label, title: `${label.title} · Rephrase ready` } : label;
