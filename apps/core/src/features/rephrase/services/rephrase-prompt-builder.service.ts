import type { RephraseTone } from "@gc/protocol";
import type { ChatMessage } from "../../providers";

// The system prompt and the passage are the same for every tone, so a local server can reuse
// that prefix across the four calls; only the last line names the tone.
const SYSTEM_RULES = `You rewrite a short passage of English or French text in one tone. You never add or remove information.

Tones:
- "professional": formal and polite.
- "casual": relaxed and conversational.
- "concise": shorter; remove filler and repetition, keep every fact.
- "friendlier": warmer and kinder.

Rules:
- Every rewrite fixes all grammar, spelling and punctuation errors.
- Keep a sentence only if it has no error at all and already fits the tone. A sentence with any error is always rewritten, never kept.
- Keep the writer's meaning. Keep names, numbers, dates, amounts and facts exactly as written.
- Keep the language of the passage. Never translate: English stays English, French stays French (standard French, not Québec usage).
- The passage is given as numbered sentences. Return segments that cover every sentence number exactly once, in order.
- A segment is one sentence, or several consecutive sentences merged into one rewrite. Never reorder sentences and never split one.
- A kept sentence is {"sentences":[3],"keep":true}. A rewrite is plain text, without the sentence numbers.

Reply with JSON only, no prose and no code fences, in this shape:
{"language":"en","segments":[{"sentences":[1,2],"text":"..."},{"sentences":[3],"keep":true}]}
"language" is the language of the passage: "en" or "fr".

Example. For the passage
1. hey, the report are late.
2. We need it by Friday.
and the tone "casual", reply:
{"language":"en","segments":[{"sentences":[1],"text":"Hey, the report is late."},{"sentences":[2],"keep":true}]}`;

/** One model call for one tone of the numbered sentences. No dictionary is involved. */
export const buildRephrasePrompt = (
  sentences: readonly string[],
  tone: RephraseTone,
): ChatMessage[] => [
  { role: "system", content: SYSTEM_RULES },
  {
    role: "user",
    content: `PASSAGE:\n${sentences.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nTONE: ${tone}`,
  },
];

/** Follow-up sent when the previous reply could not be parsed. Does not echo the bad reply. */
export const REPHRASE_RETRY_MESSAGE: ChatMessage = {
  role: "user",
  content:
    'Your previous reply was not valid JSON in the required shape. Reply again with JSON only: {"language":"en","segments":[...]}.',
};
