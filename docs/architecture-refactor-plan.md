# Architecture Refactor Plan — Grammar Checker

**Date:** 2026-11-11
**Repo:** `vicodut/speller-check`
**Goal:** Organize the apps by feature, separate shared UI from feature code, and keep every move reviewable.

---

## 1. Principles

| Concern | Decision |
|---|---|
| Organization | **Feature folders first.** Each feature owns its files. |
| Inside a feature | **Flat while small** (about 10 files or fewer). Past that, group by sub-feature, or by role if the files are one kind. Create a role folder only when it would hold 3+ files. |
| Shared code | `components/ui/` for primitives, `lib/` for helpers used by 2+ features. Never import another feature's internals. |
| React scope | React for rendering: the settings page, the Chrome card, and the Chrome options page. Content-script DOM logic stays vanilla TS. |
| Naming | `kebab-case.role.ts(x)`, matching existing files: `.hook.ts`, `.reducer.ts`, `.client.ts`, `.util.ts`, `.variants.ts`. |
| Commits | Conventional Commits. Pure moves in their own commit. |

**Adopted rule** (in `AGENTS.md`, "Code shape"; logged in `docs/decisions.md`):

> Start flat inside a feature. Once a feature passes about 10 files, group by role or sub-feature. Create a role folder only when it holds 3+ files.

The old rule ("3+ files of one kind") left folders of 39 to 85 files in place. That's why the threshold changed.

---

## 2. Current State (from the inventory)

File counts include tests and fixtures. Features over the 10-file threshold are marked **split**.

| Area | Feature | Files | Status |
|---|---|---|---|
| `apps/settings-web/src` | root (5 features mixed) | 39 at root | **split** |
| `apps/core/src/features` | `transport` | 38 | **split** |
| | `check` | 36 | **split** |
| | `settings` | 24 | **split** |
| | `rephrase` | 17 | **split** |
| | `providers` | 13 | **split** |
| | `local-models` | 13 | **split** |
| | `runtime` | 12 | **split** |
| | `dictionary` | 9 | flat, ok |
| `apps/chrome/src/content/features` | `underlines` | 20 | **split** |
| | `rephrase` | 17 | **split** |
| | `status-badge` | 11 | borderline; check |
| | `card`, `field-watcher`, `write-back`, `text-edits`, `email-cleaning`, `site-gate`, `check-memory`, `text-cap` | 3–6 | flat, ok |
| `apps/chrome/src/content/shared` | — | 13 | check: every file must be used by 2+ features |
| `apps/chrome/src/background` | — | 9 | flat, ok |
| `apps/chrome/src/options` | — | 6 | flat, ok |
| `apps/mac` | — | Swift | not touched |

Core's top level is `features/`, `shared/`, `cli/`, `composition/`. Those are the only root folders.

---

## 3. Target Layout: `apps/settings-web/src/`

Feature folders first. Each feature stays flat while it is under about 10 files.

```
src/
├── app/                      # entry only
│   ├── index.tsx
│   ├── app.tsx
│   └── app.css
├── features/
│   ├── settings/             # settings page shell, reducer, settings API client
│   ├── profiles/             # profile form, list, row, probe, presets
│   ├── models/               # local models panel, downloader hook and util
│   ├── ollama/               # ollama panel and runtime hook
│   └── token/                # extension token and page token
├── components/
│   └── ui/                   # shared primitives only (already exists)
└── lib/                      # helpers used by 2+ features (error-text.util.ts, if shared)
```

Each feature gets an `index.ts` exposing only its public API. Any feature that grows past about 10 files gets sub-grouping in its own follow-up change.

Mapping from the current root (confirm in Step A; the inventory is partial):

| Current file(s) | Target |
|---|---|
| `index.tsx`, `app.css`, `index.html` | `app/` |
| `settings-page.tsx`, `settings-page.reducer.ts`, `settings-api.client.ts`, `feature-settings.tsx`, `settings-api-runtime.client.test.ts` | `features/settings/` |
| `profile-*.tsx`, `profile-*.ts`, `probe-text.util.ts`, `profile-presets.ts`, `profile-uses.util.ts` | `features/profiles/` |
| `local-models*.ts(x)`, `local-model-controls.tsx`, `pull-progress.util.ts`, `ollama-pull.tsx` | `features/models/` (pull progress may belong here) |
| `ollama-*.tsx`, `ollama-*.ts` | `features/ollama/` |
| `extension-token.tsx`, `page-token.util.ts` | `features/token/` |
| `error-text.util.ts` | `lib/` if 2+ features use it, otherwise its feature |
| `components/ui/*` | unchanged |
| `profile-test.tsx` | Check first; it may be a dev-only page |

The `*.variants.ts` files stay in `components/ui/`, not under any feature.

---

## 4. Other Apps

### 4.1 `apps/core/src/features/` — split the seven large features

Groups are proposals from file names. Confirm by reading imports in Step A.

**`transport` (38 files)** — keep `index.ts` at the feature root.

| New folder | Files |
|---|---|
| `http/` | `http-api.handler.ts`, `http-guard.util.ts` (+ test), `http-api.server.test.ts`, `settings-page-files.repository.ts`, `settings-page.server.test.ts` |
| `routes/` | `probe-routes`, `profile-routes`, `local-models-routes`, `runtime-routes` `.handler.ts` (4 files, so a role folder qualifies), plus their server tests |
| `websocket/` | `websocket.server.ts` (+ test), `connection.handler.ts` (+ test), `connection-guard.service.ts` (+ test), `connection-text-edit.handler.test.ts`, `connection-handler.fixture.ts`, `received-texts.store.ts` (+ test), `text-edit.util.ts` (+ test) |
| `install-token/` | `install-token.repository.ts`, `install-token.watcher.ts` (+ tests), `token-rotation.server.test.ts`, `token-rotate-api.server.test.ts` |
| flat | `server-deps.types.ts`, `fake-openai.fixture.ts`, `profiles-server.fixture.ts`, `profiles*.server.test.ts`, `probe.server.test.ts`, `local-models.server.test.ts`, `runtime.server.test.ts`, `index.ts` |

Flat should stay under 10 after the move, or the tests can move into their route/sub-feature folder.

**`settings` (24 files)**

| New folder | Files |
|---|---|
| `profiles/` | `profile-config.util.ts`, `profile-keys.service.ts`, `profiles.util.ts` (+ test), `keychain.repository.ts`, `settings-keys.service.test.ts`, `profile-keys` test |
| `file/` | `settings-file.repository.ts` (+ test), `settings-file.schema.ts`, `settings.loader.ts` (+ test), `settings-env.loader.test.ts` |
| `usage/` | `feature-model.util.ts`, `feature-profiles.util.ts` (+ tests), `settings-features.service.test.ts` |
| flat | `settings.service.ts` (+ test), `settings.schema.ts`, `settings-view.builder.ts` (+ test), `settings-service.fixture.ts`, `index.ts` |

**`check` (36 files)** — `services/` already exists but holds 27 files, so it needs sub-feature folders too. The root has `check.service.ts`, `field-sessions.service.ts`, `check-limits.constants.ts`, `index.ts`, and their tests.

| New folder | Files |
|---|---|
| `sentences/` | `sentence-segmenter`, `sentence-batcher`, `sentence-hasher`, `neighbour-echo-trimmer`, `batch-checker` (+ tests) |
| `issues/` | `issue-locator`, `issue-offsets`, `issue-reconciler`, `suggestion-trimmer`, `text-diff`, `check-cache` (+ tests) |
| `model/` | `model-issues.requester`, `prompt-builder`, `response-parser` (+ tests) |
| `field-sessions/` | `field-sessions.service.ts` and its three test files |
| root | `check.service.ts` (+ test), `check-provider-swap.service.test.ts`, `check-limits.constants.ts`, `index.ts` |

**`rephrase` (17 files)** — `services/` holds 9 files, root holds 8.

| New folder | Files |
|---|---|
| `jobs/` | `rephrase-jobs.service.ts` (+ test), `rephrase-replay.service.test.ts` |
| `selection/` | `passage-selector.service.ts` (+ test), `tone-selector.service.ts` (+ test) |
| `output/` | `segment-validator.service.ts` (+ test), `rephrase-response-parser.service.ts`, `rephrase-prompt-builder.service.ts` |
| `cache/` | `rephrase-cache.service.ts` (+ test) |
| root | `rephrase.service.ts` (+ test), `rephrase-service.fixture.ts`, `index.ts` |

**`providers` (13 files)** — flat, no `services/`.

| New folder | Files |
|---|---|
| `openai-compatible/` | `openai-compatible.provider.ts` (+ test), `openai-compatible.schema.ts` |
| `wrappers/` | `switchable.provider.ts` (+ test), `timeout-retry.provider.ts` (+ test) |
| `probe/` | `profile-probe.provider.ts` (+ test), `probe-error.util.ts` (+ test) |
| root | `provider.ts`, `index.ts` |

**`local-models` (13 files)** — flat.

| New folder | Files |
|---|---|
| `download/` | `model-downloader.service.ts` (+ test), `model-files.repository.ts`, `resume.util.ts` (+ test), `file-hash.util.ts` (+ test) |
| `manifest/` | `curated-manifest.ts`, `manifest.util.ts` (+ test) |
| root | `local-models.service.ts` (+ test), `index.ts` |

**Cross-feature check:** a grep found no file in `check`, `rephrase`, `providers` or `local-models` importing another feature's internals. Each folder's `index.ts` is the only outside entry point. Step A still confirms this for the moved files.

### 4.2 `apps/chrome/src/content/features/` — split two features

**`underlines` (20 files)**

| New folder | Files |
|---|---|
| `measure/` | `editable-measure.service.ts`, `mirror-measure.service.ts`, `mirror-style.util.ts` (+ test), `text-split.util.ts` (+ test), `rect.util.ts` (+ test) |
| `scroll/` | `scroll-delta.util.ts` (+ test), `scroll-into-view.service.ts` |
| `overlay/` | `overlay-host.service.ts`, `overlay.styles.ts`, `underline-layer.service.ts`, `card-controller.service.ts` |
| `issues/` | `issue-filter.util.ts` (+ test), `issue-view.service.ts` |
| flat | `field-listeners.service.ts`, `index.ts` |

**`rephrase` (17 files)**

| New folder | Files |
|---|---|
| `panel/` | `rephrase-panel.model.ts`, `rephrase-section.view.ts`, `rephrase-view.model.ts` (+ test), `rephrase.styles.ts`, `tone-picker.model.ts` (+ test) |
| `replace/` | `rephrase-replace.model.ts` (+ test), `rephrase-replace.controller.test.ts` |
| flat | `rephrase.controller.ts` (+ test), `rephrase-entries.store.ts`, `caret-sentence.util.ts` (+ test), `rephrase-controller.fixture.ts`, `index.ts` |

**Check, not split:**
- `status-badge` (11 files): one over the threshold. Decide after reading it.
- `content/shared` (13 files): cross-feature code. Each file must be used by 2+ features, or it belongs in its feature.

### 4.3 Chrome options page

`apps/chrome/src/options/` already exists (6 files). It stays flat.

**Open decision:** the earlier draft said to reuse components from `settings-web`. `docs/decisions.md` (2026-11-07) says apps don't import each other. Choose one before any moves:

- **A.** Keep the options page separate. Accept some duplication.
- **B.** Move the shared React UI into a package (`packages/…`). Requires a new package and a recorded decision.

No `packages/react-shared` until a second consumer needs it.

### 4.4 `apps/mac`

Swift, not touched.

---

## 5. Migration Steps

> Touching more than 3 files, or starting a new feature: propose a short plan and wait for the owner's OK.

Each app is its own migration. Do them in this order, one at a time, with a review between each.

**Step 0 — Decisions.** Options-page choice (A or B), logged in `docs/decisions.md`. The folder rule is already adopted.

**Step A — Inventory.** For each feature listed in §3 and §4, list every file and its role, and confirm the groups by reading imports. Note any file used across features.

**Step B — Tests first (characterization).** For pure logic (reducers, API clients, utils), confirm the existing tests pass. Add tests for anything the move could break, before moving files.

**Step C — Move only.**
- Use `git mv` in one commit with no content edits, so `git log --follow` keeps history.
- Run `bun run check` (typecheck, lint, test).

**Step D — Fix imports and exports.** Separate commit. Add or update each feature's `index.ts`. Run `bun run check`.

**Step E — Shared code.** Move anything used by 2+ features to `lib/` or `components/ui/`. Separate commit.

**Step F — Order of apps.**
1. `settings-web` (pilot: `profiles/` first, then the rest). Lowest risk: a React app with its own tests.
2. `core` `settings` and `transport`.
3. `core` `check`, `rephrase`, `providers`, `local-models`, `runtime`.
4. `chrome` `underlines` and `rephrase`, then the `status-badge` and `content/shared` checks.

---

## 6. Commits and PRs

- **Move-only commit:** `refactor(settings-web): move files into features/ (no content changes)`.
- **Import fixes:** `refactor(settings-web): update imports and feature exports`.
- **Behavior changes, if any:** their own `feat` or `fix` commits.
- **PR body:** a Mermaid diagram of the folder structure before and after. Screenshots are not needed for a move-only change, and the PR should say so explicitly. For `settings-web`, run the page once in the browser to confirm nothing renders differently. For `chrome`, load the extension and check underlines and the rephrase panel.

---

## 7. Definition of Done

- No feature folder over about 10 files without sub-grouping, in `settings-web`, `core`, and `chrome`.
- No feature imports another feature's internals.
- `bun run check` passes after each commit.
- `docs/decisions.md` records the options-page choice.
- `docs/spec.md` is updated only if behavior changes (it should not, for a refactor).

---

## 8. Out of Scope

- Routing (`router.tsx`): add when routing is needed.
- `packages/react-shared/`: add when a second React app needs it.
- Behavior changes of any kind.

---

## 9. Next Actions

1. Owner decides option A or B for the Chrome options page.
2. Run Step A for `settings-web` first, then the large `core` and `chrome` features.
3. Propose the Step C commit for OK.

---

## 10. Status (2026-11-11)

- **Applied:** the `settings-web` move (Steps C and D). Layout: `app/`, `features/{settings,profiles,models,auth}`, `lib/`, `components/ui/`.
- **Tests:** `src/architecture.test.ts` checks that every relative import resolves and that features import each other only through `index.ts`. `bun run check` passes (874 tests).
- **Deviations from §3:** `profile-profile` became `profiles`; `extension-token.tsx` lives in `settings/`; shared code lives in `lib/`. Logged in `docs/decisions.md`.
- **Still open:** `features/models` holds about 16 files and is over the 10-file threshold, so it needs sub-grouping. `core` and `chrome` folders from §4 are not yet moved.
