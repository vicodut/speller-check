# Grammar Checker

macOS grammar and spelling checker. A Swift menu-bar helper and a Chrome extension are both clients of a local Bun/TS core, which calls any OpenAI-compatible LLM (local or cloud). English and standard French.

Spec: `docs/spec.md`. Read the section relevant to your task; don't load the whole file by default.
Decisions log: `docs/decisions.md`.

## Repo
- `apps/core`: Bun/TS core (providers, check pipeline, dictionary, settings, WebSocket server)
- `apps/mac`: Swift menu-bar app (Accessibility, overlay, card)
- `apps/chrome`: Chrome extension (MV3, TS)
- `packages/protocol`: Zod schemas, single source of truth for every message and model output
- `docs/`: spec and decisions

Each app has its own CLAUDE.md with its conventions. Follow it when working there.

## Commands (repo root)
- `bun install`
- `bun run typecheck`
- `bun run lint` (Biome)
- `bun test`
- `bun run check` runs all three. It must pass before you say a task is done.

## Code shape
- Files ≤ ~200 lines, functions ≤ ~40 lines, one exported class per file. Over the limit: split before continuing.
- Organize by feature first, then by technical role.
- Start flat inside a feature (`dictionary.service.ts`, `dictionary.repository.ts`). Move files into `services/`, `dto/`, `repositories/`… only when a feature has 3+ files of that kind.
- A feature exposes its public API through its `index.ts`. Never import another feature's internals.
- Cross-feature code lives in `shared/`. Nothing goes there "just in case".
- File names: `kebab-case.role.ts` (e.g. `issue-locator.service.ts`, `check-request.dto.ts`).

## Working rules
- Touching more than 3 files, or starting a new feature: propose a short plan and wait for my OK.
- Ask before adding any dependency.
- Write tests with the code. Pure logic (segmenting, hashing, offset mapping, versioning) is test-first.
- Commit locally once `bun run check` passes, using Conventional Commits (`feat(core): …`). Never push.
- When a decision changes, update `docs/spec.md` and add a dated line to `docs/decisions.md`.

## Never
- Log or persist user text, prompts or model responses. Logs carry event names, lengths, timings and error codes only.
- Read secure or password fields.
- Put API keys in config files, fixtures or the repo.
- Bind a server to anything other than `127.0.0.1`.
- Edit generated files (`*.generated.*`) by hand.

## Agent skills

### Issue tracker

GitHub Issues on `vicodut/speller-check`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` at the root, `docs/decisions.md` as the decision record. See `docs/agents/domain.md`.
