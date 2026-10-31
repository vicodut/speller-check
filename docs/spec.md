# Grammar Checker — v1 Specification

As of 2026-10-30.

## Overview & goals

A macOS grammar and syntax checker that underlines errors in text fields across native apps and Chrome, powered by any LLM the user chooses, local or online.

- **Personal tool, public repo.** Built for one user first, published on GitHub.

- **Model-agnostic.** Switch provider and model in settings; local (Ollama, LM Studio, llama.cpp) and cloud (OpenAI, Mistral, OpenRouter, Anthropic) all work.

- **Bilingual.** English and standard French, including mixed text.

- **Correctness only.** v1 flags grammar, spelling and syntax. No style, tone or rewrites.

## Scope

v1 targets macOS and Chrome only, with inline underlines where possible and a floating badge everywhere else.

| Area | v1 | Later / never |

| --- | --- | --- |

| OS | macOS | Windows, Linux |

| Browser | Chrome (extension) | Safari, Firefox |

| Native Cocoa apps (Notes, Mail, TextEdit…) | Inline underlines via Accessibility API | — |

| Electron apps (Slack, Discord, VS Code) | Floating badge fallback | Inline if feasible |

| Rich web editors (Gmail, Notion) | Inline underlines, "copy suggestion" if write-back fails | — |

| Google Docs | Excluded (canvas-rendered) | Maybe |

| Terminals | Excluded | Never |

| Password / secure fields | Excluded, never read | Never |

| Checks | Grammar, spelling, syntax | Style, tone, rewrites |

| Languages | English, standard French, mixed | Others |

| Model routing | One active model | Per-app routing, fallbacks |

## Architecture

A thin Swift helper and a Chrome extension are both clients of one local Bun/TS core, which owns all checking logic and model config.

```
Swift helper (macOS app) ──┐                         ┌──> Local models (Ollama, LM Studio, llama.cpp)
                           ├── WebSocket ──> Core ───┤      OpenAI-compatible API
Chrome extension ──────────┘   127.0.0.1             └──> Cloud models (OpenAI, Mistral, OpenRouter, Anthropic later)
```

- **Swift helper (eyes and hands).** Menu bar app holding the Accessibility permission. Captures text, draws, writes back. Makes no decisions. Launches the core as a child process.

- **Bun/TS core (brain).** Everything that decides: providers, prompts, cache, versioning, dictionary, settings. Runs a WebSocket server on `127.0.0.1`.

- **Chrome extension.** Same role as the Swift helper, for web pages. Connects to the same core, so model switching lives in one place.

- **Protocol.** JSON messages tagged by `type`. Clients send `hello {token}` first, then `text.changed {fieldId, version, text}`, `field.closed {fieldId}` and `dictionary.add {term}`. The core sends `ready`, `issues {fieldId, version, issues[]}`, `error {code, fieldId?}` and `settings.changed {model, local}`. The server listens on `127.0.0.1:7341` (`GC_PORT`); the install token is printed by `core token`.

## Checking pipeline

Only changed sentences are sent to the model, and every result is checked against the current text before it is drawn.

1. **Capture.** A client (Swift helper or Chrome extension) watches the focused field and sends its full text to the core on change.

2. **Debounce.** The core waits 1 s after the last keystroke before checking.

3. **Snapshot.** Each request carries a `fieldId` and an incrementing `version`. The core keeps the text of that version.

4. **Segment and hash.** Text is split into sentences. Each sentence is hashed; cached results are reused, only new or changed sentences go to the model.

5. **Check.** Changed sentences are sent in one batched request with surrounding context and the dictionary. Each distinct sentence is sent once; neighbouring unchanged sentences are included as context the model must not report on. Results are cached per sentence (clean sentences cache as an empty list), keyed by sentence hash + model.

6. **Map.** Each returned issue is located in the snapshot text using `original` + `context` (see Model layer). Issues that can't be located unambiguously are dropped. Issues are searched only inside the checked sentences; whitespace runs and straight/curly apostrophes match loosely, and the issue's `original` is replaced by the exact source slice. Overlapping issues keep the first one.

7. **Reconcile.** If the field's version moved on while the model ran, issues are re-mapped onto the new text. An issue whose `original` no longer exists at that spot is dropped. Stale results are never drawn.

8. **Publish.** The core sends issues with character offsets to the client, which draws them. Offsets are UTF-16 code units (JS string indices, NSString/AX ranges), `end` exclusive.

Latency is not a v1 goal, but correctness of placement is: an underline in the wrong place is worse than no underline.

## Model layer & output contract

One OpenAI-compatible adapter covers every v1 provider; the model returns snippets, never character offsets.

**Providers.** A single adapter speaking the OpenAI Chat Completions format, configured by `baseUrl`, `apiKey` and `model`. That covers Ollama, LM Studio, llama.cpp server, OpenAI, Mistral and OpenRouter. A native Anthropic adapter is optional, behind the same `Provider` interface. The provider is a thin transport: it returns the raw reply, and the check pipeline owns prompting, parsing and locating:

```ts
interface Provider {
  readonly model: string;
  complete(messages: ChatMessage[]): Promise<Result<string, AppError>>;
  listModels?(): Promise<Result<string[], AppError>>;
  healthcheck(): Promise<boolean>;
}
```

The adapter requests `response_format: {type: "json_object"}`; if the endpoint rejects it (HTTP 400/422) it retries without it and stops sending it. Requests use `temperature: 0` and a 60 s timeout. An optional `reasoningEffort` setting (`none | low | medium | high`) is sent as `reasoning_effort` when set; `none` disables thinking on reasoning models such as qwen3, which otherwise exceed the timeout on CPU.

**Output contract.** The model must return JSON only, validated with a schema (Zod). Invalid JSON is retried once, then the batch is skipped. Reasoning blocks (`<think>`) and code fences are stripped before parsing; a bare array is accepted. Individual issues that fail the schema (e.g. an unknown `type`), or whose suggestion equals the original, are dropped without failing the batch.

```json
{
  "issues": [
    {
      "original": "teh",
      "suggestion": "the",
      "reason": "Spelling",
      "context": "fixed teh bug in",
      "type": "spelling"
    }
  ]
}
```

- `context` = a few words around `original`, used to find the right occurrence when it appears more than once.

- `type` = `grammar` | `spelling` | `syntax` | `punctuation`, used for underline colour.

- `reason` is written in the language of the sentence.

**Prompt rules.** Flag only clear errors, never style. Never translate. French follows standard international French, not Québec usage. Words in the dictionary are always correct. Mixed English/French text is checked per sentence in its own language.

**Model switching.** Changing provider or model in settings applies to the next request without a restart and clears the sentence cache.

## Dictionary

The dictionary does two jobs: it suppresses flags on known terms, and it tells the model those terms exist so it doesn't "correct" them.

- **Filter (post-model).** Any issue whose `original` is a dictionary entry, or contains one (whole word) that the suggestion changes or removes, is dropped before display. This is the hard guarantee. A fix that keeps the term intact ("NestJS are" → "NestJS is") is kept.

- **Context (pre-model).** Entries whose term appears in the batch (checked sentences + context) are injected into the prompt so the model doesn't rewrite them toward what it expected (e.g. "NestJS" → "Nest JS").

- **Entries.** Plain terms, case-sensitive by default, with an optional note (e.g. "product name"). File format: `{ "entries": [{ "term", "note"?, "caseInsensitive"? }] }`. A missing file is an empty dictionary; an invalid file fails the check.

- **Adding.** "Add to dictionary" in the suggestion card, or manually in settings.

- **Storage.** A local JSON file in the app's Application Support folder, easy to back up or sync.

## UX: underlines, badge, card

Errors are underlined inline where the field exposes its layout, and counted in a floating badge where it doesn't.

**Underlines.** A wavy line under each issue, colour by `type` (e.g. red for spelling, blue for grammar). In Chrome, drawn by the extension over the page. In native apps, drawn by the Swift helper in a transparent overlay window, using the Accessibility API to get the on-screen bounds of each text range. Underlines follow scrolling and window moves, and disappear when the field loses focus.

**Floating badge.** A small pill at the corner of the focused field showing the error count. Used in every app; it is the only indicator where inline bounds aren't available (Electron apps). Clicking it opens a panel listing all issues for that field.

**Suggestion card.** Opens on clicking an underline or a panel item:

- Original → suggestion, and the reason in one line

- **Accept** writes the fix back into the field

- **Dismiss** hides this occurrence

- **Add to dictionary** for flagged words

- **Copy** when write-back isn't reliable (rich editors such as Gmail, Notion, Slack)

**Write-back.** Native fields: set the selected range's value through the Accessibility API. Web: select the range and dispatch native input events so React-controlled inputs and rich editors register the change. If write-back fails or the field's text doesn't match afterward, the card falls back to Copy.

**Menu bar.** Status (active / paused / model unreachable), pause for 1 h, disable for the current app, open settings.

## Settings, privacy, security

The app never logs text, never reads secure fields, and keeps API keys in the macOS Keychain.

| Setting | Default | Notes |

| --- | --- | --- |

| Provider base URL | [`http://localhost:11434/v1`](http://localhost:11434/v1`) (Ollama) | Any OpenAI-compatible endpoint |

| API key | empty | Stored in Keychain, never in the config file |

| Model | first from `listModels` | Free-text fallback |

| Languages | English + French | Standard French |

| Debounce | 1000 ms | |

| App blocklist | 1Password, Keychain Access, terminals | Bundle IDs |

| Site blocklist | banking domains (user-defined) | Chrome only |

| Local-only mode | off | Refuses any non-localhost base URL |

| Launch at login | on | |

**Privacy rules.**

- Secure text fields (`AXSecureTextField`, `input[type=password]`) are never read.

- No text, issue or prompt is written to disk or logs. Debug logging records only lengths, timings and error codes.

- Text leaves the machine only when a non-local provider is configured; the menu bar shows which.

**Local transport.** The core's WebSocket binds to `127.0.0.1` only and requires a per-install token, so other local processes or web pages can't use it.

## Open source & packaging

One monorepo on GitHub, shipped as a single .app that embeds the core binary.

**Repo layout.**

```
/apps/mac           Swift helper (menu bar app, AX, overlay, card)
/apps/core          Bun/TS core (providers, pipeline, dictionary, WS server)
/apps/chrome        Chrome extension (TS, Manifest V3)
/packages/protocol  Shared message types (Zod), Swift types generated from them
```

**Packaging.** The core is compiled to a single binary (Bun `--compile` or Node SEA) and bundled inside the .app. The Swift app launches it as a child process and restarts it if it crashes.

**Signing.** Use a fixed signing identity from day one, so macOS keeps the Accessibility permission across rebuilds. Public releases need a Developer ID and notarization; until then, users build from source.

**Chrome extension.** Loaded unpacked for v1. Chrome Web Store later, if ever.

**Repo hygiene.** No keys or personal dictionary in the repo; a sample config only. MIT licence suggested.

## Milestones & open questions

Build the brain first, prove it in Chrome, then take on the hard native part.

1. **Core + CLI.** Provider adapter, prompt, JSON validation, sentence hashing. Done when `echo "text" | core check` returns correct issues with Ollama and one cloud model, in English and French.

2. **Chrome extension.** Underlines and card in plain `textarea`/`input`, then rich editors. Proves the protocol, versioning and write-back.

3. **Swift helper: read.** Menu bar app, Accessibility permission, focused-field text capture, badge with error count.

4. **Swift helper: draw.** Overlay underlines from AX bounds in Notes, Mail, TextEdit.

5. **Swift helper: write.** Card, Accept/Dismiss/Add to dictionary, Copy fallback.

6. **Settings + packaging.** Settings window, Keychain, blocklists, bundled core binary, signed build.

**Open questions**

- [ ] Card UI in native apps: SwiftUI (simpler) or a WebView reusing the extension's React card?

- [ ] Bun `--compile` vs Node SEA for the core binary? (Kickoff decision: Bun, to confirm at milestone 6.)

- [ ] Which local model is good enough for French grammar? Benchmark 3–4 candidates on a small test set at milestone 1.

- [ ] How to handle very long fields (e.g. a long email): check only paragraphs near the cursor?

