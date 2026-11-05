import { RephraseTone } from "@gc/protocol";

/** The tones to make for a request: the ones asked for (all four if none), in display order. */
export const selectTones = (requested: readonly RephraseTone[] | undefined): RephraseTone[] =>
  RephraseTone.options.filter((tone) => !requested || requested.includes(tone));
