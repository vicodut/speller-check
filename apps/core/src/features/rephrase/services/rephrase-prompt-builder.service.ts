import type { ChatMessage } from "../../providers";

const SYSTEM_RULES = `You rewrite a short passage of English or French text in four tones. You never add or remove information.

Tones:
- "professional": formal and polite.
- "casual": relaxed and conversational.
- "concise": shorter; remove filler and repetition, keep every fact.
- "friendlier": warmer and kinder.

Rules:
- Keep the writer's meaning. Keep names, numbers, dates, amounts and facts exactly as written.
- Keep the language of the passage. Never translate: English stays English, French stays French (standard French, not Québec usage).
- The passage is given as numbered sentences. For each tone, return segments that cover every sentence number exactly once, in order.
- A segment is one sentence, or several consecutive sentences merged into one rewrite. Never reorder sentences and never split one.
- When a sentence already fits the tone, return it as kept: {"sentences":[3],"keep":true}.
- A rewrite is plain text, without the sentence numbers.

Reply with JSON only, no prose and no code fences, in this shape:
{"language":"en","versions":[{"tone":"professional","segments":[{"sentences":[1,2],"text":"..."},{"sentences":[3],"keep":true}]},{"tone":"casual","segments":[...]},{"tone":"concise","segments":[...]},{"tone":"friendlier","segments":[...]}]}
"language" is the language of the passage: "en" or "fr".

Example. For the passage
1. hey, the report is late.
2. we need it by friday.
reply:
{"language":"en","versions":[{"tone":"professional","segments":[{"sentences":[1],"text":"Hello, the report is running late."},{"sentences":[2],"text":"We would need it by Friday."}]},{"tone":"casual","segments":[{"sentences":[1],"keep":true},{"sentences":[2],"keep":true}]},{"tone":"concise","segments":[{"sentences":[1,2],"text":"The report is late; we need it by Friday."}]},{"tone":"friendlier","segments":[{"sentences":[1],"text":"Hi! Just a heads-up that the report is a bit late."},{"sentences":[2],"text":"Could we have it by Friday? Thanks so much!"}]}]}`;

/** One model call for all four tones of the numbered sentences. No dictionary is involved. */
export const buildRephrasePrompt = (sentences: readonly string[]): ChatMessage[] => [
  { role: "system", content: SYSTEM_RULES },
  { role: "user", content: `PASSAGE:\n${sentences.map((s, i) => `${i + 1}. ${s}`).join("\n")}` },
];

/** Follow-up sent when the previous reply could not be parsed. Does not echo the bad reply. */
export const REPHRASE_RETRY_MESSAGE: ChatMessage = {
  role: "user",
  content:
    'Your previous reply was not valid JSON in the required shape. Reply again with JSON only: {"language":"en","versions":[...]}.',
};
