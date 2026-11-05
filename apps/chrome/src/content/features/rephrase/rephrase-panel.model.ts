import type { RephraseEntry } from "./rephrase-entries.store";
import { buildRephraseView, type RephraseVersionView, shownTones } from "./rephrase-view.model";
import { type ToneButtonView, toneButtons, toneLabel } from "./tone-picker.model";

/** What the panel's rephrase section shows for a field; `tones` are the tone buttons. */
export type RephrasePanelState =
  | { readonly kind: "idle"; readonly enabled: boolean; readonly tones: readonly ToneButtonView[] }
  | {
      readonly kind: "result";
      readonly tones: readonly ToneButtonView[];
      readonly versions: readonly RephraseVersionView[];
      /** Labels of the tones still loading; empty once the request is done. */
      readonly pending: readonly string[];
      /** The last Replace couldn't edit the field: this text is offered to copy instead. */
      readonly copy?: string;
    };

/** No result: the four tone buttons, in English, usable when the caret is in a sentence. */
export const idlePanel = (enabled: boolean): RephrasePanelState => ({
  kind: "idle",
  enabled,
  tones: toneButtons("en", [], []),
});

/** A kept result: its versions, the tones still loading, and the buttons to add a tone. */
export const resultPanel = (entry: RephraseEntry): RephrasePanelState => {
  const { draft, runs, copy } = entry;
  const language = draft?.language ?? "en";
  const inFlight = entry.loading ? entry.pending : [];
  const tones = toneButtons(language, shownTones(draft), inFlight);
  const versions = draft ? buildRephraseView(draft, runs) : [];
  const pending = inFlight.map((tone) => toneLabel(language, tone));
  const result = { kind: "result", tones, versions, pending } as const;
  return copy === undefined ? result : { ...result, copy };
};
