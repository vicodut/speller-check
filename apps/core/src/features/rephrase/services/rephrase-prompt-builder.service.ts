import type { RephraseTone } from "@gc/protocol";
import type { ChatMessage } from "../../providers";

// The system prompt is the same for every tone, so a local server can reuse that prefix across
// the four calls. Only the tone's guide and example, then the passage, follow in the user turn.
const SYSTEM_RULES = `You rewrite a short English or French passage in one requested tone.

Rules:
- Make the tone obvious: someone reading the four tones side by side must tell them apart. Changing word choice, sentence shape and courtesy phrases is expected, not just fixing errors.
- Fix every grammar, spelling and punctuation error.
- Keep the meaning and every fact: names, numbers, dates, times, amounts. Courtesy words (greetings, thanks) may be added or removed; facts never.
- Keep the passage's language. Never translate. French is standard French, not Québec usage.
- The passage comes as numbered sentences. Return segments covering every number once, in order. A segment rewrites one sentence or merges consecutive ones; never reorder or split.
- Keep a sentence ({"sentences":[n],"keep":true}) only if it has no error and already reads exactly like the tone.

Reply with JSON only, no prose, no code fences:
{"language":"en"|"fr","segments":[{"sentences":[1,2],"text":"..."},{"sentences":[3],"keep":true}]}`;

type ToneGuide = { readonly guide: string; readonly example: string };

// Same example passage for every tone, so the model sees what this tone changes.
const EXAMPLE_PASSAGE = "1. hi, the report are late.\n2. we need it by friday!";

const TONES: Record<RephraseTone, ToneGuide> = {
  professional: {
    guide:
      'Professional: formal and polite, as to a client or a recruiter. Complete sentences, no exclamation marks, no slang or contractions. Polite turns such as "I would be available", "Could you please". French: vouvoiement, "Je serais disponible", "Pourriez-vous".',
    example:
      '{"language":"en","segments":[{"sentences":[1],"text":"Hello, the report is running late."},{"sentences":[2],"text":"Could you please send it to us by Friday?"}]}',
  },
  casual: {
    guide:
      'Casual: relaxed, like a quick message to a colleague you know well. Short sentences, contractions, everyday words. French: "dispo", "pas de souci", "Salut" is fine.',
    example:
      '{"language":"en","segments":[{"sentences":[1],"text":"Hey, the report\'s late."},{"sentences":[2],"text":"We need it by Friday!"}]}',
  },
  concise: {
    guide:
      "Concise: as short as possible while keeping every fact. Cut at least a third of the words: drop filler, repetition and pleasantries, merge sentences that say related things.",
    example:
      '{"language":"en","segments":[{"sentences":[1,2],"text":"The report is late; we need it by Friday."}]}',
  },
  friendlier: {
    guide:
      'Friendlier: warm and kind. Thank or reassure the reader, use positive phrasing, and add a friendly closing such as "Looking forward to it" or "Au plaisir d\'échanger". One exclamation mark is fine.',
    example:
      '{"language":"en","segments":[{"sentences":[1],"text":"Hi! Just a heads-up that the report is running a little late."},{"sentences":[2],"text":"We\'d really appreciate it by Friday, thanks so much!"}]}',
  },
};

/** One model call for one tone of the numbered sentences. No dictionary is involved. */
export const buildRephrasePrompt = (
  sentences: readonly string[],
  tone: RephraseTone,
): ChatMessage[] => {
  const { guide, example } = TONES[tone];
  const passage = sentences.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return [
    { role: "system", content: SYSTEM_RULES },
    {
      role: "user",
      content: `${guide}\n\nExample passage:\n${EXAMPLE_PASSAGE}\nExample reply:\n${example}\n\nPASSAGE:\n${passage}\n\nTONE: ${tone}`,
    },
  ];
};

/** Follow-up sent when the previous reply could not be parsed. Does not echo the bad reply. */
export const REPHRASE_RETRY_MESSAGE: ChatMessage = {
  role: "user",
  content:
    'Your previous reply was not valid JSON in the required shape. Reply again with JSON only: {"language":"en","segments":[...]}.',
};
