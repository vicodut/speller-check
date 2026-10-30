import { describe, expect, test } from "bun:test";
import { buildPrompt } from "./prompt-builder.service";

describe("buildPrompt", () => {
  const messages = buildPrompt({
    sentences: ["I has went.", "Il sont partis."],
    context: ["Hello."],
    dictionary: "- NestJS (framework)",
  });
  const [system, user] = messages;

  test("returns a system and a user message", () => {
    expect(messages.map((m) => m.role)).toEqual(["system", "user"]);
  });

  test("system rules cover the spec's prompt rules", () => {
    for (const rule of [
      /never flag style/i,
      /never translate/i,
      /Québec/,
      /DICTIONARY are always correct/,
      /language of the sentence/,
    ]) {
      expect(system?.content).toMatch(rule);
    }
  });

  test("user message has dictionary, context and numbered sentences in order", () => {
    expect(user?.content).toBe(
      "DICTIONARY:\n- NestJS (framework)\n\nCONTEXT:\nHello.\n\nCHECK:\n1. I has went.\n2. Il sont partis.",
    );
  });

  test("omits empty sections", () => {
    const [, bare] = buildPrompt({ sentences: ["One."], context: [], dictionary: "" });
    expect(bare?.content).toBe("CHECK:\n1. One.");
  });
});
