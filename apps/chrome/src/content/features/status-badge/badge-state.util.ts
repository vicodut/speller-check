import type { Issue } from "@gc/protocol";

/** What the badge shows for the focused field. */
export type BadgeState =
  | { readonly kind: "checking" }
  | { readonly kind: "count"; readonly issues: readonly Issue[] }
  | { readonly kind: "failed"; readonly code: string }
  | { readonly kind: "offline"; readonly status: "auth_failed" | "unreachable" };

export type BadgeLabel = { text: string; title: string; variant: string };

const plural = (n: number) => (n === 1 ? "1 issue" : `${n} issues`);

/** Text, tooltip and style variant for a state. Counts above 9 show as "9+". */
export const badgeLabel = (state: BadgeState): BadgeLabel => {
  switch (state.kind) {
    case "checking":
      return { text: "", title: "Checking…", variant: "checking" };
    case "count": {
      const n = state.issues.length;
      if (n === 0)
        return { text: "✓", title: "No issues found: click to rephrase", variant: "clean" };
      const text = n > 9 ? "9+" : String(n);
      return { text, title: `${plural(n)}: click to list them or rephrase`, variant: "issues" };
    }
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
