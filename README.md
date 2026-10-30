# Grammar Checker

A grammar and spelling checker for macOS, in English and standard French. A Swift menu-bar helper and a Chrome extension both send text to a local Bun/TypeScript core. The core calls any OpenAI-compatible LLM, local (e.g. Ollama) or cloud, and returns issues with exact text offsets.

See `docs/spec.md` for the full product spec and `docs/decisions.md` for the decisions log.
