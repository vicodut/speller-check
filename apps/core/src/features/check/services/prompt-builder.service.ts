import type { ChatMessage } from "../../providers";

export type PromptInput = {
  /** Sentences to check. */
  readonly sentences: readonly string[];
  /** Neighbouring sentences, given for understanding only. */
  readonly context: readonly string[];
  /** Pre-rendered dictionary lines (see dictionary feature). Empty when none apply. */
  readonly dictionary: string;
};

const SYSTEM_RULES = `You are a proofreader for English and French text. You find errors; you do not rewrite.

Rules:
- Flag only clear errors: grammar, spelling, syntax, punctuation. Never flag style, tone, word choice or wording that is merely unusual.
- Never translate. Each suggestion stays in the language of its sentence.
- Check each sentence in its own language; a text may mix English and French.
- French follows standard international French (France), not Québec usage.
- Words listed under DICTIONARY are always correct. Never flag or change them.
- Check only the sentences under CHECK. Sentences under CONTEXT are there to help you understand; never report issues in them.

For each error return:
- "original": the shortest exact substring of the sentence that is wrong, copied character for character.
- "suggestion": the replacement for "original".
- "reason": a short explanation written in the language of the sentence.
- "context": 3 to 8 words copied exactly from the sentence, containing "original", so it can be located.
- "type": one of "grammar", "spelling", "syntax", "punctuation".

Reply with JSON only, no prose and no code fences, in this shape:
{"issues":[{"original":"teh","suggestion":"the","reason":"Spelling","context":"fixed teh bug in","type":"spelling"}]}
If there are no errors, reply {"issues":[]}.`;

const section = (title: string, lines: readonly string[]): string =>
  lines.length === 0 ? "" : `${title}:\n${lines.join("\n")}`;

export const buildPrompt = (input: PromptInput): ChatMessage[] => {
  const user = [
    input.dictionary ? `DICTIONARY:\n${input.dictionary}` : "",
    section("CONTEXT", input.context),
    section(
      "CHECK",
      input.sentences.map((s, i) => `${i + 1}. ${s}`),
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
  return [
    { role: "system", content: SYSTEM_RULES },
    { role: "user", content: user },
  ];
};

/** Follow-up sent when the previous reply could not be parsed. Does not echo the bad reply. */
export const JSON_RETRY_MESSAGE: ChatMessage = {
  role: "user",
  content:
    'Your previous reply was not valid JSON in the required shape. Reply again with JSON only: {"issues":[...]}.',
};
