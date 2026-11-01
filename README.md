# Grammar Checker

A grammar and spelling checker for macOS, in English and standard French. A Swift menu-bar helper and a Chrome extension both send text to a local Bun/TypeScript core. The core calls any OpenAI-compatible LLM, local (e.g. Ollama) or cloud, and returns issues with exact text offsets.

See `docs/spec.md` for the full product spec and `docs/decisions.md` for the decisions log.

## Run it locally (Chrome)

```sh
bun install
bun run dev                              # starts Ollama if needed, then the core on 127.0.0.1:7341
bun run --cwd apps/core cli token        # paste this into the extension's Options page
bun run build:chrome                     # then load apps/chrome/dist unpacked in chrome://extensions
```

`bun run dev` defaults to Ollama with `qwen3:8b` (thinking off). Set `GC_BASE_URL`, `GC_MODEL`, `GC_API_KEY` or `GC_REASONING_EFFORT` to use another model; Ollama is only started when `GC_BASE_URL` points at it. After rebuilding the extension, reload it and then reload open tabs.
