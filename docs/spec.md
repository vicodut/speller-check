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

| Checks | Grammar, spelling, syntax; on-demand rephrasing in four tones, one tone per click (Chrome) | Automatic style/tone checks, custom tones |

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

- **Protocol.** JSON messages tagged by `type`. Clients send `hello {token}` first, then `text.changed {fieldId, version, text}`, `text.edit {fieldId, version, baseVersion, start, deleteCount, insert}`, `field.closed {fieldId}`, `dictionary.add {term}`, `rephrase.request {fieldId, version, requestId, text, caret, tones?}` (`tones`: non-empty, unique tones to make; omitted means all four), `rephrase.cancel {fieldId}` and `ping` (a keepalive the Chrome extension sends every 20 s while connected, because Chrome stops an MV3 worker after ~30 s without activity; the core ignores it). The core sends `ready`, `issues {fieldId, version, issues[], pending?}`, `rephrase.tone {fieldId, version, requestId, passage, sentences[], language, tone, segments[]}` (one per tone, as it is ready), `rephrase.done {fieldId, version, requestId, count}` (`count`: tones sent for that request), `error {code, fieldId?, request?, requestId?}` (`request: "rephrase"` marks a failed rephrase, never a failed check) and `settings.changed {model, local}`. The server listens on `127.0.0.1:7341` (`GC_PORT`); the install token is printed by `core token`. `core token --rotate` replaces it (written to a temporary file and renamed over the old one, mode 0600) and prints the new one. A running core re-reads the token file whenever it changes (one `stat` per hello or API call), so the old token is refused from the next hello and API call, without a restart; connections already authenticated stay open. A missing or invalid token file makes the core refuse every token. After a rotation, paste the new token into the extension options and run `core settings` again for the page (a fresh link replaces the stored token). The same port answers plain HTTP for the settings API: `GET /api/settings` returns the settings in effect for each feature (`check`, `rephrase`), each value with its source (`env` plus the env var name, `default`, or `unset`) and, for the API key, only whether one is set. Every HTTP request must carry `Host: 127.0.0.1:<port>` (or `localhost:<port>`), which blocks DNS rebinding; API calls also need no `Origin` or the core's own (`http://127.0.0.1:<port>`), so websites and the extension are refused, and the install token as `Authorization: Bearer <token>`. Errors are `{error: <code>}` (`host_forbidden`, `origin_forbidden`, `auth_failed`, `not_found`, `method_not_allowed`), logged as `http.rejected` with the code. `core serve` logs `settings.loaded` with each setting's source, never a value. The same port also serves the settings page (`apps/settings-web`, React, built into static files) at `/settings`: only its three built files are reachable, with a CSP allowing only its own script, style and API (`frame-ancestors 'none'`, no referrer). `core settings` (or `bun run settings`) opens it at `http://127.0.0.1:<port>/settings#token=<install token>`; the fragment never reaches the server, and the page stores the token in its local storage, then clears it from the address bar. The token is the same between sessions, so a bookmark keeps working until `core token --rotate`. The page is read-only for now: each feature's settings with their source.

   **Text edits.** `text.edit` is one contiguous edit (UTF-16 offsets, like everything else) against the field's text at `baseVersion`, the last version the client sent: `deleteCount` code units at `start` become `insert`, giving `version`. The Chrome extension diffs the last text it sent with the new one (common prefix and suffix) and sends `text.edit` while typing; it sends the full `text.changed` on a field's first send, on focus, on the resend after `core.ready`, after a resync request, after the field was closed or over the cap, and whenever the edit would not be smaller than the full text. The core keeps, per connection and open field, the last text and version it received (`text.changed` or rebuilt), and drops it on `field.closed`. A `text.edit` whose `baseVersion` matches is rebuilt, checked against the length cap (`text_too_long`), then handled exactly as a `text.changed` with that text (snapshot, debounce, batches, reconcile, publish and the rephrase edit check are unchanged). An unknown field, another `baseVersion`, a version not moving forward or an edit past the end of the text gets `error {code: "resync_needed", fieldId}` and no check; the extension then sends the field's full current text as `text.changed` with a new version (or, for a blurred field, stops waiting for its result). `resync_needed` never shows as a failed check. Logs: `text.edit_applied` (rebuilt length), `text.resync_needed` (code). Never text.

## Checking pipeline

Only changed sentences are sent to the model, and every result is checked against the current text before it is drawn.

1. **Capture.** A client (Swift helper or Chrome extension) watches the focused field and sends its full text to the core on change.

   In a contenteditable field the Chrome extension leaves out text the writer didn't write: `blockquote`s on every site, and on Gmail (`mail.google.com`) the quoted thread and the signature (`.gmail_quote`, `.gmail_quote_container`, `.gmail_extra`, `.gmail_attr`, `.gmail_signature`, `.gmail_signature_prefix`). Skipped parts are never sent, underlined or written to; a skipped block still separates the lines around it, and offsets map between the sent text and the DOM through the same text model everywhere. Providers are pluggable adapters picked by hostname (the `email-cleaning` feature); others (Outlook…) come later.

   **Length cap.** Sent text (after email cleaning) is capped at 20,000 characters (UTF-16 code units), `MAX_TEXT_LENGTH` in the protocol package, shared by the clients and the core; not a user setting. Over the cap the extension sends no text: it sends `field.closed` instead (so the core and background drop any check still pending for the field), clears the underlines and the badge shows "too long" (…). A rephrase of an over-cap field is never sent. When the field drops back under the cap, its text is sent again as a new version and checked as usual. As a safety net the core refuses longer text with `text_too_long` before any model call: a check (field session or `core check`) and a rephrase (`error {request: "rephrase"}`) alike. Logs carry the code and the length only.

   **Refocus reuse (Chrome).** The extension remembers, in memory only and never persisted, per field the last text it sent and the issues the core returned for it (the last 8 fields). Focusing a field whose current text is exactly that text shows the remembered issues and count at once (dismissals and dictionary-hidden words still apply) and sends nothing to the core; it still gets a new version, so older results stay stale. A different text, no remembered result, an edit, or the resend after `core.ready` checks as usual (the core dropped the field's session on blur, so that is a first check; the sentence cache keeps it cheap). A blur while a check is in flight delays `field.closed` until its result or error arrives (at most 60 s, or until the core reconnects), so that result is remembered too; refocusing before then keeps the field open. A dictionary addition forgets every remembered result.

2. **Debounce.** The core waits 1 s after the last keystroke before checking.

3. **Snapshot.** Each request carries a `fieldId` and an incrementing `version`. The core keeps the text of that version (sent in full, or rebuilt from a `text.edit`).

4. **Segment and hash.** Text is split into sentences. Each sentence is hashed; cached results are reused, only new or changed sentences go to the model.

5. **Check.** Changed sentences are sent in one batched request with surrounding context and the dictionary. Each distinct sentence is sent once; neighbouring unchanged sentences are included as context the model must not report on. Results are cached per sentence (clean sentences cache as an empty list), keyed by sentence hash + model.

   **Batches.** The uncached sentences are grouped in document order into batches of at most 10 sentences or 1,500 characters of sentence text (`BATCH_MAX_SENTENCES`, `BATCH_MAX_CHARS`, next to `DEBOUNCE_MS` in the core's `check-limits.constants.ts`; not user settings), checked one after another, one model call each; a single sentence over 1,500 characters gets a batch of its own. Each batch keeps the neighbour-sentence context, and each finished batch is cached at once. After every batch but the last, the field session publishes all issues found so far for that version as `issues {…, pending: true}`; the last publish carries no flag, so a check that fits one batch looks as it always did. A failed batch ends the check with its error code (issues already published stay drawn). `core check` runs every batch and returns one result. Logs: `check.batches` (count), `check.batch_done` (ms, sentences), `check.batches_dropped` (count).

   **Edits during a batched check.** A field runs one check at a time. When a newer version arrives, the check in flight finishes its current batch (published as a partial, reconciled onto the newer text), drops the remaining batches, and the newer check starts as soon as it ends (the debounce having fired), reusing every sentence already cached. Closing the field also drops the remaining batches.

6. **Map.** Each returned issue is located in the snapshot text using `original` + `context` (see Model layer). Issues that can't be located unambiguously are dropped. Words the suggestion repeats from right before or after `original` are trimmed, so Accept never duplicates them. Issues are searched only inside the checked sentences; whitespace runs and straight/curly apostrophes match loosely, and the issue's `original` is replaced by the exact source slice. A result never holds two fixes for the same words: of issues whose ranges overlap, the one starting first wins (ties: the shorter); touching ranges both stay. Then, when only whitespace separates an issue from the previous kept one, the leading words of its suggestion that the previous suggestion already ends with are removed, with a trailing English contraction expanded ("Their" → "They're" then "going" → "are going": "are" is already supplied). The issue is dropped if nothing is left to fix (empty, or equal to its `original`), and keeps the trimmed suggestion otherwise. Only counts are logged (`issues.overlap_dropped`, `issues.echo_dropped`).

7. **Reconcile.** If the field's version moved on while the model ran, issues are re-mapped onto the new text. An issue whose `original` no longer exists at that spot is dropped. Stale results are never drawn. A result is published only if it comes from a newer snapshot than the last one published, or the same snapshot while only partial (`pending`) results were published for it: partials replace each other and the final result replaces them.

8. **Publish.** The core sends issues with character offsets to the client, which draws them. A `pending: true` result is drawn but the badge keeps its spinner; the extension neither remembers it for refocus reuse nor lets it release a deferred `field.closed`: only the final result does. Clients that ignore `pending` still work, since every publish is a complete issue list. Offsets are UTF-16 code units (JS string indices, NSString/AX ranges), `end` exclusive.

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

The adapter requests `response_format: {type: "json_object"}`; if the endpoint rejects it (HTTP 400/422) it retries without it and stops sending it. Requests use `temperature: 0` and a 60 s timeout. A call that times out is retried once with a 150 s timeout, unless the caller cancelled it, so a local model that is still loading (at start, or after the server unloaded it when idle) answers on the retry instead of failing the check or the rephrase tone (`provider.retry_after_timeout`). `core serve` also sends a one-token warm-up request in the background as soon as it listens (180 s timeout, no JSON mode), so the model is usually loaded before the first check (`provider.warmup` with ms, or `provider.warmup_failed` with the code). An optional `reasoningEffort` setting (`none | low | medium | high`) is sent as `reasoning_effort` when set; `none` disables thinking on reasoning models such as qwen3, which otherwise exceed the timeout on CPU.

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

**Prompt rules.** Flag only clear errors, never style. Keep the writer's meaning: fix the verb to fit the subject, never the subject, pronouns, names, numbers or tense. Report every error in a sentence, and a multi-word error as one issue. Never translate. French follows standard international French, not Québec usage. Words in the dictionary are always correct. Mixed English/French text is checked per sentence in its own language.

**Model switching.** Changing provider or model in settings applies to the next request without a restart and clears the sentence cache.

## Dictionary

The dictionary does two jobs: it suppresses flags on known terms, and it tells the model those terms exist so it doesn't "correct" them.

- **Filter (post-model).** Any issue whose `original` is a dictionary entry, or contains one (whole word) that the suggestion changes or removes, is dropped before display. This is the hard guarantee. A fix that keeps the term intact ("NestJS are" → "NestJS is") is kept.

- **Context (pre-model).** Entries whose term appears in the batch (checked sentences + context) are injected into the prompt so the model doesn't rewrite them toward what it expected (e.g. "NestJS" → "Nest JS").

- **Entries.** Plain terms, case-sensitive by default, with an optional note (e.g. "product name"). File format: `{ "entries": [{ "term", "note"?, "caseInsensitive"? }] }`. A missing file is an empty dictionary; an invalid file fails the check.

- **Adding.** "Add to dictionary" in the suggestion card, or manually in settings.

- **Storage.** A local JSON file in the app's Application Support folder, easy to back up or sync.

## Rephrasing

On demand only: the badge panel shows four tone buttons, **Professional**, **Casual**, **Concise** and **Friendlier** (French passages: Professionnel, Décontracté, Concis, Plus chaleureux), and a click asks for that one tone of the paragraph at the caret: one model call, not four (#18). It is a separate core feature (`rephrase`) with its own prompt and model calls; the check pipeline and its output contract are unchanged, and a rephrase never counts in the badge's issue count.

- **Passage.** The core splits the text with the check's sentence segmenter and takes the paragraph holding the caret (a paragraph ends at a blank line; a single line break does not end it). A caret at either end of a sentence counts as inside it. A longer paragraph is capped around the caret's sentence to 8 sentences and 1,500 characters, growing alternately after and before it; a single sentence over 1,500 characters is still rephrased on its own. A caret in no sentence is refused with `rephrase_no_sentence` and no model call; the extension disables the tone buttons in that case (until a result is kept, see Panel).
- **Model calls.** One short call per tone, in the fixed order Professional, Casual, Concise, Friendlier. The system prompt and the numbered passage are identical across the four calls (only the last line, `TONE: <tone>`, differs), so a local server can reuse that prefix. The model answers `{"language":"en"|"fr","segments":[{"sentences":[1,2],"text"} | {"sentences":[3],"keep":true}]}`: sentence numbers, never offsets. Prompt rules: every version fixes all grammar, spelling and punctuation errors; a sentence is kept only if it has no error and already fits the tone (a sentence with an error is never kept, so "Already fits this tone" only appears for error-free text); keep the meaning, the language (never translate), names, numbers and facts; Concise shortens, Professional is formal and polite, Casual is relaxed, Friendlier is warmer; consecutive sentences may be merged, never reordered or split. The dictionary is not used. Invalid JSON is retried once per tone. Same endpoint and model as the check, with its own 60 s timeout per call.
- **Tones.** `rephrase.request` may list the `tones` to make; the core makes only those, always in display order whatever the order asked, and all four when `tones` is omitted (backward compatible).
- **Streaming and cancelling.** Each validated tone is sent as `rephrase.tone` as soon as it is ready; a failed or invalid tone is skipped (`rephrase.tone_failed` / `rephrase.version_dropped`). The request ends with `rephrase.done {count}`, or, when no tone was sent, with the rephrase error (the last provider error, else `rephrase_no_valid_version`). The core keeps at most one rephrase per field per connection and stops the remaining calls (aborting the one in flight) when a newer request for the field arrives, when a `text.changed` changes the passage text at its offsets, on `rephrase.cancel` (the background sends it when a frame's port goes away) and when the connection closes; a stopped request ends with `rephrase_cancelled`. `field.closed` (blur) does not stop it. Every reply echoes the client's `requestId`; the background routes rephrase replies to the requesting port even after the field closed, until `rephrase.done` or the error for that `requestId`.
- **Validation.** Per tone: segments that cover every sentence exactly once, in order, with no gaps, repeats, reordering or empty rewrites. A rewrite identical to its original sentences becomes kept. An invalid tone is dropped (`rephrase.version_dropped`). Every offset in `rephrase.tone` comes from the core's own split: `passage {start, end}`, `sentences[{text, start, end}]`, and segments as 0-based runs `{from, to, keep: true}` or `{from, to, text}`. The language is the model's answer ("fr…" is French, anything else English).
- **Panel.** The row of four tone buttons sits below the issue list (the panel now also opens on a clean ✓ badge), labelled in English until a tone has told the passage language. A click asks for that tone only. Clicking another tone afterwards adds its version to the same kept result, on the same text and caret as the first request (so all versions share one passage, even after a Replace or with the caret elsewhere). A tone already shown (✓) or in flight (…) can't be asked again. Since a newer request supersedes the field's running one in the core, a click while tones are in flight sends a new request for the union of the tones still missing (in flight + the new one); the core replays the ones it already finished from its cache and goes on with the rest. Versions appear in display order as their tones arrive: one block per version, rewritten parts in full, unchanged sentences faded and marked "unchanged", and "Already fits this tone" when every segment is kept; below them, a loading line per tone still to come ("Casual…"; a pending tone before one received was skipped by the core and is not pending any more; it can be clicked again). `rephrase.done`, a rephrase error or 150 s without a tone ends the loading state (its tones not received become clickable again); tones already shown stay. The result is kept per field (the last 5 fields) until the field no longer holds the passage at the same offsets: closing the panel or blurring the field keeps it, and the panel shows it when opened again. A tone that arrives while the panel isn't showing it puts a "rephrase ready" dot on the badge (and a tooltip line), cleared when the panel opens; it never changes the count. Rows and buttons are built with `textContent` only.
- **Replace.** Each rewritten part has a **Replace** button (kept parts have none) and each version that rewrites something has **Replace all**. Both use the Accept write-back (focus the field, select the range, `insertText`, re-read, one re-check after 50 ms), so focus stays in the field, undo works and the new text is grammar-checked like any other edit. Replace writes over the part's own sentences only; Replace all is one edit over the whole passage range (the passage rebuilt from the original text with that version's rewritten parts, kept sentences and the space between sentences as written), so later offsets never drift. The extension remembers the parts written so far and computes every range from the original sentences shifted by those parts, so parts from different versions apply one after another: a part already in the field shows "replaced", a part covering replaced parts overwrites them, a part straddling the edge of a replaced part has no button, and Replace all always makes the whole passage that version. Before writing, and on every render, the field must still hold the passage (with the replaced parts) at its offsets; otherwise the result is dropped and Replace never writes. A write-back that doesn't land shows "Couldn't edit this field — copy the text instead" with a Copy button for that text. A Replace while tones are still loading changes the passage, so the core stops the remaining tones (as for any edit).
- **Cache.** The core keeps an in-memory LRU (200 entries, never persisted) of validated tones keyed by model + passage hash + tone; the passage hash is SHA-256 of its sentences in order, since the prompt only holds the numbered sentences. A request replays every cached tone at once as `rephrase.tone` (offsets from the new request's own split, so the same passage elsewhere in the field still matches) and calls the model only for the missing tones; failed, invalid or cancelled tones are not cached.
- **Logs.** `rephrase.requested` (passage length), `rephrase.tone_done` (timing, segment count), `rephrase.tone_failed` (timing, code), `rephrase.version_dropped` (count), `rephrase.tone_cached` (segment count), `rephrase.done` (total timing, tones sent), `rephrase.failed` (code). Never text.

## UX: underlines, badge, card

Errors are underlined inline where the field exposes its layout, and counted in a floating badge where it doesn't.

**Underlines.** A wavy line under each issue, colour by `type` (e.g. red for spelling, blue for grammar). In Chrome, drawn by the extension over the page. In native apps, drawn by the Swift helper in a transparent overlay window, using the Accessibility API to get the on-screen bounds of each text range. Underlines follow scrolling and window moves, and disappear when the field loses focus.

**Floating badge.** A small pill at the corner of the focused field showing the error count. Used in every app; it is the only indicator where inline bounds aren't available (Electron apps). Clicking it opens a panel listing all issues for that field. Picking an issue from the panel scrolls the field (and the page, if needed) so the issue is visible, then opens its card; focus and the caret stay where they were. While a check runs the badge is a spinner; hovering it opens a small popup beside it with the time spent on that version ("Checking… 2.4s" under 10 s, then "23s", then "1m 1s"), repainted live while the pointer stays on it. Nothing shows without a hover, and the spinner has no native tooltip. It starts when a version is sent, keeps running through partial (`pending`) results and stops on the final result, an error, "too long", blur or an unreachable core.

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

| Site blocklist | banking domains (user-defined) | Chrome only; host + subdomains, parent frames count; changes apply to open tabs without a reload |

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

- [ ] Which local model is good enough for French grammar? Benchmark 3–4 candidates on a small test set at milestone 1. Only qwen3:8b has been run locally (19/20, misses the subjunctive, flags the correct "s'est lavé les mains"). Cloud runs on the same fixtures (#5, see decisions 2026-11-07): qwen3.8-flash 20/20 with no extras, qwen3.7-flash 20/20, llama-3.3-70b 19/20, mistral-small-3.2 16/20.

- [x] How to handle very long fields (e.g. a long email)? Answered by #4: email quotes and signatures are skipped, fields over 20,000 characters show "too long" and aren't sent, and long first checks run in batches with partial results (Checking pipeline, step 5). Checking only the paragraphs near the caret (and over-cap fields paragraph by paragraph) is #6; sending diffs is #7.

