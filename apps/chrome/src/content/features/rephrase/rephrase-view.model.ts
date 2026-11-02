import {
  type RephraseLanguage,
  RephraseTone,
  type RephraseToneResult,
  type RephraseVersion,
} from "@gc/protocol";

/** The tones received so far for one request, with the passage they were computed on. */
export type RephraseDraft = Pick<RephraseToneResult, "passage" | "sentences" | "language"> & {
  readonly versions: readonly RephraseVersion[];
};

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

const toneIndex = (tone: RephraseTone) => RephraseTone.options.indexOf(tone);

/** Adds a tone that just arrived; the first one starts the draft. Versions stay in tone order. */
export const addTone = (
  draft: RephraseDraft | undefined,
  tone: RephraseToneResult,
): RephraseDraft => {
  const version = { tone: tone.tone, segments: tone.segments };
  const others = (draft?.versions ?? []).filter((v) => v.tone !== tone.tone);
  const versions = [...others, version].sort((a, b) => toneIndex(a.tone) - toneIndex(b.tone));
  const { passage, sentences, language } = draft ?? tone;
  return { passage, sentences, language, versions };
};

/**
 * Labels of the tones still to come. Tones arrive in display order, so a tone before the last
 * one received was skipped and never comes. Before any tone the labels are English.
 */
export const pendingToneLabels = (draft: RephraseDraft | undefined): string[] => {
  const last = Math.max(-1, ...(draft?.versions ?? []).map((v) => toneIndex(v.tone)));
  const labels = LABELS[draft?.language ?? "en"];
  return RephraseTone.options.slice(last + 1).map((tone) => labels[tone]);
};

/** Maps a draft to one block of rows per version; consecutive unchanged sentences share a row. */
export const buildRephraseView = (draft: RephraseDraft): RephraseVersionView[] =>
  draft.versions.map((version) => {
    const rows: RephraseRow[] = [];
    for (const segment of version.segments) {
      if ("text" in segment) {
        rows.push({ kind: "rewritten", text: segment.text });
        continue;
      }
      const original = draft.sentences
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
      label: LABELS[draft.language][version.tone],
      fits: rows.every((row) => row.kind === "unchanged"),
      rows,
    };
  });

/** A result is only used while the field still holds the passage it was computed from, in place. */
export const isPassageCurrent = (
  draft: Pick<RephraseDraft, "passage">,
  sentText: string,
  currentText: string,
): boolean => {
  const { start, end } = draft.passage;
  return currentText.slice(start, end) === sentText.slice(start, end);
};
