import { type RephraseLanguage, RephraseTone } from "@gc/protocol";

/** A tone button: ask for it, it is on its way, or its version is shown. */
export type ToneStatus = "available" | "loading" | "done";

export type ToneButtonView = {
  readonly tone: RephraseTone;
  readonly label: string;
  readonly status: ToneStatus;
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

export const toneLabel = (language: RephraseLanguage, tone: RephraseTone): string =>
  LABELS[language][tone];

export const toneIndex = (tone: RephraseTone): number => RephraseTone.options.indexOf(tone);

const inOrder = (tones: Iterable<RephraseTone>): RephraseTone[] =>
  [...new Set(tones)].sort((a, b) => toneIndex(a) - toneIndex(b));

/**
 * The tones to ask the core for when `tone` is clicked: nothing if it is shown or on its way,
 * else it plus the ones still in flight. A new request supersedes the running one, so the
 * in-flight tones go with it (the core replays those it already finished from its cache).
 */
export const tonesToRequest = (
  done: readonly RephraseTone[],
  pending: readonly RephraseTone[],
  tone: RephraseTone,
): RephraseTone[] | undefined => {
  if (done.includes(tone) || pending.includes(tone)) return undefined;
  return inOrder([...pending, tone]);
};

/**
 * The tones still to come once `received` arrived. The core sends them in display order, so a
 * pending tone before it was skipped (failed or invalid) and never comes.
 */
export const pendingAfterTone = (
  pending: readonly RephraseTone[],
  received: RephraseTone,
): RephraseTone[] => {
  if (!pending.includes(received)) return [...pending];
  return pending.filter((tone) => toneIndex(tone) > toneIndex(received));
};

/** The four tone buttons in display order, labelled in the passage's language. */
export const toneButtons = (
  language: RephraseLanguage,
  done: readonly RephraseTone[],
  pending: readonly RephraseTone[],
): ToneButtonView[] =>
  RephraseTone.options.map((tone) => {
    const status = done.includes(tone) ? "done" : pending.includes(tone) ? "loading" : "available";
    return { tone, label: toneLabel(language, tone), status };
  });
