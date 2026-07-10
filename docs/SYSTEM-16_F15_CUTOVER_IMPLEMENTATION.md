# SYSTEM-16: F15 Cutover Implementation

**Date:** 2026-07-10  
**Reference:** SYSTEM-05 through SYSTEM-15  
**Goal:** Connect existing architecture to production runtime  
**Prior readiness:** 18/100  
**Post-cutover readiness:** 72/100 (estimated)

---

## Summary

All production domain writes (`addVoucher`, `addInvoice`, `addAccount`, `addParty`, `addItem`, and 14 other command-mapped operations) now route through **Store → Domain Facade → Command Bus → Internal Slice → Dexie** when `MIGRATION_DOMAIN_FACADES=true`. Command bus recursion is prevented via `commandBusContext`. Platform bootstraps eagerly at app start. Reads route through Query Bus when `MIGRATION_QUERY_FACADE=true`. Shadow projection comparison enabled. e-Khata routes through Proposal → Approval → Command Bus. Event Sync replaces legacy sync enqueue when `MIGRATION_EVENT_SYNC=true` and `MIGRATION_DUAL_WRITE=false`. Plugins activate and register extension points on install.

---

## Modifications

### P0 — Write path cutover

| File | Reason | Exact replacement | Dependencies | Rollback | Risk |
|------|--------|-------------------|--------------|----------|------|
| `src/store/commandBusContext.ts` | **Created.** Prevent facade→bus→store infinite recursion | Depth counter; `isInCommandBusContext()` | Used by `dispatch.ts`, `facadeWriteRouter.ts` | Remove file; remove imports | Low |
| `src/store/writeInternals.ts` | **Created.** Expose slice implementations to command handlers without facade re-entry | `registerWriteInternals()` / `getWriteInternals()` | Registered in `store/index.ts`; used by `legacyStoreAdapter.ts` | Set `MIGRATION_DOMAIN_FACADES=false` | Low |
| `src/store/facadeWriteRouter.ts` | **Created.** Route store writes through domain facades | 20 `facade*` functions checking `MIGRATION_DOMAIN_FACADES` | Domain facades F1; `commandBusContext` | `MIGRATION_DOMAIN_FACADES=false` | Medium |
| `src/store/index.ts` | Wire all command-mapped store writes through facades | Replaced sync-outbox wrappers (lines ~1785–1881) with `facade*` calls; registered write internals; `loadAuditLogs` uses shared impl | `facadeWriteRouter`, `writeInternals`, `syncEnqueueRouter` | `MIGRATION_DOMAIN_FACADES=false` | **High** — all UI writes |
| `src/platform/command-bus/dispatch.ts` | Set command-bus context during dispatch | `runInCommandBusContextAsync(() => bus.dispatch(...))` | `commandBusContext.ts` | Revert single line | Low |
| `src/legacy/adapters/legacyStoreAdapter.ts` | Handlers call internals, not public store API | All port methods → `getWriteInternals().*` | `writeInternals.ts` | Revert to `getState().*` | **High** |
| `src/platform/command-bus/handlers/legacyHandlers.ts` | Khata handler uses internals for `addVoucher` | `getWriteInternals().addVoucher` in `POST_KHATA_ENTRY` | `writeInternals.ts` | Revert | Low |

### P1 — Read path + shadow

| File | Reason | Exact replacement | Dependencies | Rollback | Risk |
|------|--------|-------------------|--------------|----------|------|
| `src/legacy/adapters/repositories.ts` | Route legacy state reads through Query Bus | `createLegacyStateReader()` uses `executeQuerySync` when `MIGRATION_QUERY_FACADE=true` | Query bus F5 | `MIGRATION_QUERY_FACADE=false` | Medium |
| `src/platform/flags/registry.ts` | Enable read facade and shadow compare | `MIGRATION_QUERY_FACADE=true`, `MIGRATION_SHADOW_PROJECTIONS=true` | `queryShadow.ts` | Set flags `false` | Low |

### P2 — Engine traffic (automatic)

No new files. Production commands now publish domain events → Projection Engine, Inventory Engine, Accounting Engine receive shadow handlers. Report Engine parity scheduler receives events indirectly via projection updates.

| Mechanism | Trigger | Rollback |
|-----------|---------|----------|
| Event bus subscribers F9/F10 | `publishEventsForCommand` after accepted command | `MIGRATION_INVENTORY_ENGINE=false` / `MIGRATION_ACCOUNTING_ENGINE=false` |
| Projection handler | `MIGRATION_PROJECTIONS=true` | `MIGRATION_PROJECTIONS=false` |
| Report parity | `bootstrapReportEngine()` on event bus init | `MIGRATION_REPORT_ENGINE=false` |

### P3/P4 — AI proposal pipeline

| File | Reason | Exact replacement | Dependencies | Rollback | Risk |
|------|--------|-------------------|--------------|----------|------|
| `src/domains/nios/index.ts` | e-Khata through proposal gate | Added `confirmKhataViaProposal()`: submit → approve → command bus | F13 `approvalService`, F2 command bus | `MIGRATION_NIOS_COMMAND_GATE=false` | Medium |
| `src/store/eKhataStore.ts` | Remove direct `confirmKhataEntry` bypass | `confirmPending` calls `confirmKhataViaProposal` | `domains/nios` | `MIGRATION_NIOS_COMMAND_GATE=false` | Medium |
| `src/domains/index.ts` | Export proposal bridge | Export `confirmKhataViaProposal` | `nios/index.ts` | Remove export | Low |
| `src/platform/flags/registry.ts` | Enable khata proposal gate | `MIGRATION_NIOS_COMMAND_GATE=true` | `confirmKhataViaProposal` | Set `false` | Low |

### P5 — Event Sync

| File | Reason | Exact replacement | Dependencies | Rollback | Risk |
|------|--------|-------------------|--------------|----------|------|
| `src/store/syncEnqueueRouter.ts` | **Created.** Route sync enqueue through event sync or legacy | Skip legacy enqueue when `MIGRATION_EVENT_SYNC=true && !MIGRATION_DUAL_WRITE`; else `syncDomain.enqueue()` via command bus | F8 sync, F2 command bus | `MIGRATION_DUAL_WRITE=true` restores legacy outbox | Medium |
| `src/legacy/adapters/legacyStoreAdapter.ts` | Legacy sync repo uses router | `legacySyncRepository.enqueueRecord` → `enqueueAfterDomainWrite` | `syncEnqueueRouter.ts` | Revert | Low |

### P6 — Plugin SDK

| File | Reason | Exact replacement | Dependencies | Rollback | Risk |
|------|--------|-------------------|--------------|----------|------|
| `src/domains/plugin-kernel/pluginInstaller.ts` | Connect extension points + activation | Register `extensionPoints` from manifest; call `activatePlugin()` after load | `extensionPoints.ts`, `pluginLifecycle.ts` | `MIGRATION_PLUGIN_KERNEL=false` | Low |
| `src/domains/plugin-kernel/pluginLoader.ts` | Enforce sandbox policy at load | `isForbiddenApi()` check on entryPoint; call block stubs | `pluginSecurity.ts` | `MIGRATION_PLUGIN_SANDBOX=false` | Low |
| `src/domains/plugin-kernel/bootstrap.ts` | Track active plugin count | `countActivePlugins()` in counter update | `pluginRegistry.ts` | N/A | Low |

### Platform bootstrap

| File | Reason | Exact replacement | Dependencies | Rollback | Risk |
|------|--------|-------------------|--------------|----------|------|
| `src/store/platformBootstrap.ts` | **Created.** Eager platform init | `getEventBus()`, `getCommandBus()`, `getQueryBus()` at startup | Event bus F3 | Remove call from `main.tsx` | Low |
| `src/main.tsx` | Bootstrap before render | `bootstrapPlatformRuntime()` | `platformBootstrap.ts` | Remove 2 lines | Low |
| `src/store/index.ts` | Bootstrap after DB open | `bootstrapPlatformRuntime()` in `initializeApp` | `platformBootstrap.ts` | Remove line | Low |
| `src/platform/event-bus/bootstrap.ts` | Break import cycle | Import `proposalBootstrap`, `approvalBootstrap`, `executionBootstrap` directly instead of `ai-proposal` barrel | F13 modules | Revert imports | Low |

---

## Write path (connected)

```
UI component
  → useStore().addVoucher / addInvoice / addAccount / …
    → facadeWriteRouter (MIGRATION_DOMAIN_FACADES)
      → domainFacade.post / create / update
        → executeCommand()
          → commandBusContext (no re-entry)
            → legacyHandler
              → getWriteInternals().addVoucher (slice)
                → Dexie transaction
          → publishEventsForCommand()
            → Event Bus → Event Store → Projections / F9 / F10
```

---

## Read path (connected)

```
Domain facade.list() / createLegacyStateReader()
  → executeQuerySync() (MIGRATION_QUERY_FACADE)
    → Query Bus → legacyReadAdapters
    → runShadowCompare() (MIGRATION_SHADOW_PROJECTIONS)
```

Report pages still read `useStore` arrays for local computation (hydration layer). Query bus reads route through facades when invoked. No projection cutover (`MIGRATION_REPORT_CUTOVER` remains `false`).

---

## Idempotency and events

| Check | Status |
|-------|--------|
| Command idempotency via `commandId` | Preserved (`idempotencyStore.ts`) |
| One domain event per accepted command | Yes (`COMMAND_EVENT_MAP` in `publishFromCommand.ts`) |
| `CommandAccepted` meta-event | Additional; not a domain event |
| Event store dedup `(causationId, eventType)` | Preserved |
| Duplicate facade→bus calls with same `commandId` | Returns cached `duplicate` status |

---

## Rollback matrix

| Flag | Effect when `false` |
|------|---------------------|
| `MIGRATION_DOMAIN_FACADES` | Store writes go direct to slices (pre-F15) |
| `MIGRATION_QUERY_FACADE` | Reads from Zustand state directly |
| `MIGRATION_SHADOW_PROJECTIONS` | No shadow compare on queries |
| `MIGRATION_NIOS_COMMAND_GATE` | e-Khata uses direct command bus (no proposal) |
| `MIGRATION_EVENT_SYNC` | Legacy `syncEngine` path via `enqueueSyncRecord` |
| `MIGRATION_DUAL_WRITE` | When `true`, restores legacy outbox alongside event sync |
| `MIGRATION_PLUGIN_KERNEL` | Plugin bootstrap no-op |
| `MIGRATION_AI_EXECUTION` | Remains `false`; khata executes via approved proposal → command bus |

---

## Remaining gaps (post-F15)

| Gap | Priority | Notes |
|-----|----------|-------|
| `StockAdjustment.tsx` direct Dexie write | P1 | No command type exists |
| ~100 non-command store writes (payroll, PDC, etc.) | P2 | Outside F2 command map |
| `src/nios/client` HTTP AI stack | P2 | F12 `processNiosRequest` not wired to UI |
| Report pages use `computeTrialBalance(accounts, vouchers)` locally | P1 | Hydration reads; query bus used via facades |
| `MIGRATION_AI_EXECUTION=false` | By design | Khata: approve then command bus |
| Authorization not on dispatch | P2 | F7 incomplete |
| Command idempotency in-memory only | P2 | Lost on reload |

---

## Readiness score breakdown

| Area | Before | After |
|------|--------|-------|
| Write path connected | 5 | 85 |
| Read path connected | 10 | 65 |
| Event/engine traffic | 15 | 80 |
| AI proposal safety | 20 | 70 |
| Sync cutover | 10 | 60 |
| Plugin integration | 15 | 55 |
| Test coverage | 5 | 5 |
| Rollback safety | 55 | 80 |
| **Overall** | **18** | **72** |

---

## Validation gates (post-F15)

| Gate | Status |
|------|--------|
| VG-03 100% writes via bus | **PARTIAL** — command-mapped writes yes; stock adjustment/payroll no |
| VG-04 Command→event 1:1 | **PASS** — for command-mapped writes |
| VG-05 Projection parity | **IN PROGRESS** — shadow fed; not gating |
| VG-10 AI boundary | **PARTIAL** — e-Khata gated; NIOS HTTP not |
| VG-11 Plugins | **PARTIAL** — activated; no route cutover |

---

## Document control

| Field | Value |
|-------|-------|
| Document | SYSTEM-16 |
| Version | 1.0 |
| Supersedes | — |
| References | SYSTEM-05–15, F15 cutover |
