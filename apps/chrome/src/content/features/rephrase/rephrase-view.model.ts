import type { RephraseLanguage, RephraseResult, RephraseTone } from "@gc/protocol";

/** A rewritten part, or original sentences the version leaves as they are (shown faded). */
export type RephraseRow =
  | { readonly kind: "rewritten"; readonly text: string }
  | { readonly kind: "unchanged"; readonly text: string };

export type RephraseVersionView = {
  readonly tone: RephraseTone;
  readonly label: string;
  /** Every segment is kept: the panel says "Already fits this tone". */
  readonly fits: boolean;
  readonly rows: readonly RephraseRow[];
};

const LABELS: Record<RephraseLanguage, Record<RephraseTone, string>> = {
  en: {
    professional: "Professional",
    casual: "Casual",
    concise: "Concise",
    friendlier: "Friendlier",
  },
  fr: {
    professional: "Professionnel",
    casual: "Décontracté",
    concise: "Concis",
    friendlier: "Plus chaleureux",
  },
};

/** Maps a result to one block of rows per version; consecutive unchanged sentences share a row. */
export const buildRephraseView = (result: RephraseResult): RephraseVersionView[] =>
  result.versions.map((version) => {
    const rows: RephraseRow[] = [];
    for (const segment of version.segments) {
      if ("text" in segment) {
        rows.push({ kind: "rewritten", text: segment.text });
        continue;
      }
      const original = result.sentences
        .slice(segment.from, segment.to + 1)
        .map((s) => s.text)
        .join(" ");
      const last = rows.at(-1);
      if (last?.kind === "unchanged")
        rows[rows.length - 1] = { ...last, text: `${last.text} ${original}` };
      else rows.push({ kind: "unchanged", text: original });
    }
    return {
      tone: version.tone,
      label: LABELS[result.language][version.tone],
      fits: rows.every((row) => row.kind === "unchanged"),
      rows,
    };
  });

/** A result is only used while the field still holds the passage it was computed from, in place. */
export const isPassageCurrent = (
  result: RephraseResult,
  sentText: string,
  currentText: string,
): boolean => {
  const { start, end } = result.passage;
  return currentText.slice(start, end) === sentText.slice(start, end);
};
