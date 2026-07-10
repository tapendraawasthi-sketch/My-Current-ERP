# AI Execution Runtime — Migration Notes

## Feature Flag

Enable with `VITE_MIGRATION_AI_RUNTIME=true` or runtime override:

```typescript
import { setMigrationFlagOverride } from "@/platform/flags/registry";
setMigrationFlagOverride("MIGRATION_AI_RUNTIME", true);
```

Default: `false` (shadow mode until UI integration).

## Dependencies (existing flags)

| Flag | Required for |
|------|----------------|
| `MIGRATION_COMMAND_BUS` | Command execution |
| `MIGRATION_QUERY_BUS` | Read tools (search, reports, inventory) |
| `MIGRATION_EVENT_BUS` | Domain event observation |
| `MIGRATION_AI_PROPOSALS` | Write path via proposals |
| `MIGRATION_AI_APPROVAL` | Human approval gate |
| `MIGRATION_AI_EXECUTION` | Auto-execute low-risk approved proposals |

## Bootstrap Integration

`bootstrapAiRuntime()` is called from:

- `src/store/platformBootstrap.ts` (eager init)
- `src/platform/event-bus/bootstrap.ts` (composition root)

## Consolidation Path

| Existing stack | Migration target |
|----------------|------------------|
| `src/domains/nios-core/` | Pipeline stages delegate to ai-runtime |
| `src/domains/ai-proposal/` | Approval + command execution (unchanged) |
| `src/ai/` (SUTRA client RAG) | UI layer calls `processAiRequest()` |
| `src/nios/client/` | HTTP adapter wraps ai-runtime |

## Non-Goals (this release)

- Vector database for long-term memory
- LLM provider binding (use `MIGRATION_NIOS_PROVIDERS` extension point)
- Direct Zustand/Dexie writes from AI

## Rollout Stages

1. **Stage 0**: Flag off, unit tests pass
2. **Stage 1**: Flag on in dev, read-only queries via tool router
3. **Stage 2**: Proposal pipeline for writes, approval required
4. **Stage 3**: UI integration (E-Khata panel → `processAiRequest`)
5. **Stage 4**: Deprecate direct store reads in `src/ai/rag/*`

## Extension Points

Register plugins via `getExtensionRegistry().register(plugin)`.

Register custom tools via `registerTool(customTool)`.

Bind LLM providers via future `reasoning/llmProvider.ts` adapter.

## Test Command

```bash
npm run test:ai-runtime
```
