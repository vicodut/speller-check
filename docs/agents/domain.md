# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root.
- **`docs/decisions.md`**: the dated decisions log. Read the entries that touch the area you're about to work in.
- **`docs/spec.md`**: the product spec. Read only the section relevant to the task, not the whole file.

If `GLOSSARY.md` doesn't exist, **proceed silently**. Don't flag its absence; don't suggest creating it upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates it lazily when terms actually get resolved.

## Recording decisions

This repo has no `docs/adr/`. Don't create one. Record a decision as a dated line in `docs/decisions.md`, and update `docs/spec.md` when the decision changes it (as `CLAUDE.md` requires).

## File structure

Single-context repo:

```
/
├── GLOSSARY.md
├── docs/
│   ├── spec.md
│   └── decisions.md
├── apps/
│   ├── core/
│   ├── chrome/
│   └── mac/
└── packages/protocol/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag decision conflicts

If your output contradicts an entry in `docs/decisions.md`, surface it explicitly rather than silently overriding:

> _Contradicts the 2026-10-31 decision (token per install), but worth reopening because…_
