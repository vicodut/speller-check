import type { ProfileInput } from "@gc/protocol";

/** Starting points for "Add profile". Local ones run on this Mac; cloud ones will need a key (#34). */
export const PRESETS: readonly { label: string; input: ProfileInput }[] = [
  {
    label: "Ollama (local)",
    input: {
      name: "Local",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "qwen3:8b",
      reasoningEffort: "none",
    },
  },
  {
    label: "LM Studio (local)",
    input: {
      name: "LM Studio",
      baseUrl: "http://127.0.0.1:1234/v1",
      model: "",
      reasoningEffort: null,
    },
  },
  {
    label: "OpenRouter",
    input: {
      name: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "qwen/qwen3.8-flash",
      reasoningEffort: null,
    },
  },
  {
    label: "Mistral",
    input: {
      name: "Mistral",
      baseUrl: "https://api.mistral.ai/v1",
      model: "mistral-small-latest",
      reasoningEffort: null,
    },
  },
  {
    label: "OpenAI",
    input: {
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      model: "",
      reasoningEffort: null,
    },
  },
];
