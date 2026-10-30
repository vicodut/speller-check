# Decisions

- 2026-10-30: macOS + Chrome only for v1.
- 2026-10-30: Architecture = Swift helper + Bun/TS core + Chrome extension; the core owns all logic.
- 2026-10-30: One OpenAI-compatible provider adapter; native Anthropic adapter later.
- 2026-10-30: Model returns {original, suggestion, reason, context, type}; the core computes offsets.
- 2026-10-30: Standard international French, not Québec usage.
- 2026-10-30: Core uses plain TS with manual constructor injection, no NestJS.
- 2026-10-30: Expected failures return Result; exceptions only for programmer errors.
- 2026-10-30: Zod schemas in packages/protocol are the single source of truth; Swift types are generated.
- 2026-10-30: Tooling = Bun workspaces, bun test, Biome, SwiftFormat/SwiftLint, XcodeGen.
