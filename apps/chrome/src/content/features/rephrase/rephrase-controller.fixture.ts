import type {
  RephraseDoneMessage,
  RephraseRequestMessage,
  RephraseTone,
  RephraseToneMessage,
} from "@gc/protocol";
import { expectedTextAfterFix, matchesText, type TextFix } from "../write-back";
import { RephraseController } from "./rephrase.controller";

export type FakeField = { text: string; caret: number | null };

export const setup = (
  text = "Intro. Hello there.",
  caret: number | null = 10,
  timeoutMs = 1000,
) => {
  const field: FakeField = { text, caret };
  const sent: RephraseRequestMessage[] = [];
  let changes = 0;
  const writes = { applied: [] as TextFix[], fails: false };
  const controller = new RephraseController<FakeField>({
    send: (m) => sent.push(m),
    readText: (f) => f.text,
    readCaret: (f) => f.caret,
    // The write-back: edits the fake field unless told to fail or the range changed.
    apply: async (f, fix) => {
      if (writes.fails || !matchesText(f.text, fix)) return false;
      f.text = expectedTextAfterFix(f.text, fix);
      writes.applied.push(fix);
      return true;
    },
    changed: () => changes++,
    timeoutMs,
  });
  controller.track(field, "f1", 3);
  return { field, sent, controller, writes, changes: () => changes };
};

export const tone = (name: RephraseTone, requestId = 1, version = 3): RephraseToneMessage => ({
  type: "rephrase.tone",
  fieldId: "f1",
  version,
  requestId,
  passage: { start: 0, end: 19 },
  sentences: [
    { text: "Intro.", start: 0, end: 6 },
    { text: "Hello there.", start: 7, end: 19 },
  ],
  language: "en",
  tone: name,
  segments: [
    { from: 0, to: 0, keep: true },
    { from: 1, to: 1, text: "Hey." },
  ],
});

export const done = (requestId = 1, count = 1): RephraseDoneMessage => ({
  type: "rephrase.done",
  fieldId: "f1",
  version: 3,
  requestId,
  count,
});

export const tones = (state: ReturnType<RephraseController<FakeField>["state"]>) =>
  state.kind === "result" ? state.versions.map((v) => v.tone) : [];
