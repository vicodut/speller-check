# Core (Bun + TypeScript)

## Stack
Bun, TypeScript strict, Zod, `bun test`, Biome.
No framework: plain classes with constructor injection, wired by hand in `src/main.ts` (composition root). No DI container, no decorators.

## Layout
```
src/
  main.ts              composition root
  cli.ts               CLI entry (`core check`)
  features/
    check/             segment, hash, cache, prompt, parse, locate, (reconcile: milestone 2)
    providers/         Provider interface + OpenAI-compatible adapter
    dictionary/        entries, JSON repository, filter, prompt context
    settings/          config loading and validation
    transport/         WebSocket server (milestone 2)
  shared/              result.ts, logger.ts, errors
test/fixtures/         EN, FR and mixed samples
```

## Conventions
- Expected failures (network, invalid model JSON, issue that can't be located) return `Result<T, E>` from `shared/result.ts`. Throw only for programmer errors.
- Validate every external input with Zod at the boundary: model output, config, dictionary file, WebSocket messages. Inside, trust the types.
- Providers are the only code that touches the network. Repositories are the only code that touches the filesystem. Services hold the logic.
- Prefer pure functions. The cache and field-session services are the only places with in-memory state.
- The logger accepts structured fields only (`event`, `ms`, `len`, `code`), never free text, so user text can't leak into logs.
- Tests sit next to the code: `issue-locator.service.test.ts`.
- Tests that call a real model are opt-in (`bun run test:models`, needs env vars) and never part of `bun test`.

## Env
`GC_BASE_URL`, `GC_MODEL`, `GC_API_KEY` (optional for local models), `GC_DICTIONARY_PATH`, `GC_REASONING_EFFORT` (optional).
In production the Swift app reads the key from the Keychain and passes these to the core at launch.
