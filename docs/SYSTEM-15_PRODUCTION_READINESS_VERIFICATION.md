# SYSTEM-15: Production Readiness Verification

**Date:** 2026-07-10  
**Scope:** F0–F14 implementation vs SYSTEM-05 through SYSTEM-14 canonical architecture  
**Method:** Static code audit, runtime wiring trace, handler completeness, invariant review  
**Authority:** Legacy ERP (`useStore` + Dexie) remains production source of truth until cutover gates pass

---

## Executive Summary

The migration scaffolding (Command Bus, Event Bus, Event Store, Query Bus, Projections, Sync, Identity, shadow engines F9–F10, proposal pipeline F13, plugin kernel F14) is **implemented as additive infrastructure** but is **not on the production write/read path**. All UI pages continue to mutate state through `useStore` → Dexie. Shadow engines, projections, and parity runners receive little or no production traffic. Validation gates VG-01 through VG-11 (SYSTEM-07) are **not met**.

**Release readiness score: 18 / 100**

| Category | Score | Notes |
|----------|-------|-------|
| Architecture completeness | 72 | Modules exist per SYSTEM-08/09 |
| Runtime integration | 22 | Lazy init; UI bypasses buses |
| Invariant safety | 15 | Shadow stale; dual sync; no cutover |
| Test coverage | 5 | No platform/engine unit tests |
| Rollback safety | 55 | Flags disable new paths; parity-off auto-passes |
| Production blockers cleared | 0 / 12 | See §Production Blockers |

---

## Phase-by-Phase Verification (F0–F14)

### F0 — Foundation (flags, kernel contracts, context)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **PARTIAL** | `flags/registry.ts`, `kernel/*`, `context/zustandContextProvider.ts` used by buses; `platform/index.ts` barrel never imported |
| 2 | Dead code | **YES** | `@fios/platform` barrel orphan; 10 flags defined but never read (see §Missing Feature-Flag Report) |
| 3 | Orphan modules | **YES** | `src/platform/index.ts` |
| 4 | Duplicate responsibilities | **LOW** | Kernel contracts vs bus implementations — acceptable separation |
| 5 | Unnecessary abstractions | **LOW** | Kernel contract layer justified for F1+ |
| 6 | Legacy bypass | **CRITICAL** | No app-level bootstrap; `main.tsx` does not initialize platform |
| 7 | Feature flags | **OK** | 40 flags in registry with env override |
| 8 | Dependency direction | **OK** | Kernel has no domain imports |
| 9 | Layer violations | **NONE** in F0 |
| 10 | Circular dependencies | **NONE** in F0 |
| 11–25 | Events/commands/queries/etc. | **N/A** | F0 is contracts + flags only |

**F0 verdict:** Design artifacts present; no eager platform bootstrap at app entry.

---

### F1 — Domain Isolation (bounded contexts, facades)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **ORPHAN** | 18 domain facades in `src/domains/*/index.ts`; **zero** imports from `src/pages` or `src/components` |
| 2 | Dead code | **YES** | All `@fios/domains` and per-domain `@fios/*` aliases unused at runtime |
| 3 | Orphan modules | **YES** | `voucher`, `invoice`, `accounting`, `inventory`, `party`, `masters`, `company`, `fiscal-year`, `numbering`, `tax`, `reporting`, `audit`, `notification`, `sync`, `nios`, `document` facades |
| 4 | Duplicate responsibilities | **HIGH** | Facades mirror command-bus handlers; both exist, only bus path is reachable (and rarely used) |
| 5 | Unnecessary abstractions | **MEDIUM** | Facades add indirection without UI adoption |
| 6 | Legacy bypass | **CRITICAL** | 180+ `useStore` references across `src/pages`; `MIGRATION_DOMAIN_FACADES=true` never enforced |
| 7 | Feature flags | **MISSING** | `MIGRATION_DOMAIN_FACADES` defined, never checked |
| 8 | Dependency direction | **OK** | Domains → platform (correct) |
| 9 | Layer violations | **NONE** |
| 10 | Circular dependencies | **NONE** in F1 facades |

**F1 verdict:** Physical extraction complete; strangler not engaged.

---

### F2 — Command Bus

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **PARTIAL** | Lazy init via `executeCommand()` in `dispatch.ts`; handlers in `legacyHandlers.ts` |
| 2 | Dead code | **LOW** | `idempotencyStore.ts` in-memory only |
| 3 | Orphan modules | **NONE** |
| 4 | Duplicate responsibilities | **HIGH** | Handlers delegate to same `legacyStoreAdapter` as direct store calls |
| 5 | Unnecessary abstractions | **LOW** |
| 6 | Legacy bypass | **CRITICAL** | UI calls `addVoucher`/`addInvoice` directly; `src/store/**` has zero `executeCommand` |
| 7 | Feature flags | **OK** | `MIGRATION_COMMAND_BUS` gates dispatch |
| 8 | Dependency direction | **OK** | command-bus → legacy adapters |
| 9 | Layer violations | **NONE** |
| 10 | Circular dependencies | **RISK** | Via ai-proposal barrel (see §Layer-Violation Report) |
| 12 | Every command has handler | **PASS** | 24/24 wired |
| 16 | Idempotency | **PARTIAL** | In-memory `commandId` dedup; lost on reload |
| 17 | Transaction boundaries | **LEGACY OK** | `voucherSlice`/`invoiceSlice` use Dexie transactions; bus path uses same slices |
| 24 | Rollback safety | **OK** | Flag off → `executeCommand` throws; UI unaffected |

**F2 verdict:** Handler coverage complete; VG-03 (100% writes via bus) **FAILED**.

---

### F3 — Event Bus

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **PARTIAL** | `getEventBus()` only from `publishFromCommand.ts` and `pluginEvents.ts` (unreachable) |
| 2 | Dead code | **YES** | `onLegacyDomainEvent()` in `legacyBridge.ts` — zero callers |
| 3 | Orphan modules | **PARTIAL** | `legacyBridge.onLegacyDomainEvent` |
| 4 | Duplicate responsibilities | **HIGH** | 4 subscribers named for side effects but only log |
| 5 | Unnecessary abstractions | **LOW** |
| 6 | Legacy bypass | **CRITICAL** | Store writes do not publish events |
| 7 | Feature flags | **OK** | `MIGRATION_EVENT_BUS` gates publish |
| 8 | Dependency direction | **VIOLATION** | bootstrap imports F9–F14 domains (see §Layer-Violation Report) |
| 10 | Circular dependencies | **YES** | bootstrap ↔ ai-proposal barrel |
| 11 | Every event consumed | **PARTIAL** | 25/26 published; `HandlerFailed` never published; several events have no business consumer |
| 24 | Rollback safety | **OK** | Flag off → commands succeed, no events |

**F3 verdict:** Bus functional when commands flow; production traffic does not reach it.

---

### F4 — Event Store

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **PARTIAL** | Middleware in event-bus pipeline; Dexie v23 tables in `db.ts` |
| 2 | Dead code | **YES** | `bootstrapEventStore()`, `runEventMigrations()`, `eventSnapshots.ts`, `eventCompaction.ts` |
| 3 | Orphan modules | **YES** | Snapshots, compaction, explicit bootstrap |
| 4 | Duplicate responsibilities | **LOW** |
| 5 | Unnecessary abstractions | **LOW** | Snapshot/compaction stubs premature |
| 6 | Legacy bypass | **CRITICAL** | No events from UI → store mostly empty |
| 7 | Feature flags | **OK** | `MIGRATION_EVENT_STORE`, `MIGRATION_SAFE_OPEN_DB` |
| 14 | Projections rebuildable | **YES** | Via `projectionRebuilder.ts` when events exist |
| 15 | Replay correctness | **PARTIAL** | `eventReplay.ts` works; accounting replay partial |
| 16 | Idempotency | **OK** | Dedup via `(causationId, eventType)` |
| 25 | Migration gates | **OK** | Non-destructive Dexie schema additive |

**F4 verdict:** Persistence layer ready; starved of production events. VG-04 (command→event 1:1) **FAILED** for UI path.

---

### F5 — Query Bus

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **PARTIAL** | `reportingDomain` uses `executeQuerySync`; pages do not import it |
| 2 | Dead code | **PARTIAL** | `queryShadow.ts` inactive (`MIGRATION_SHADOW_PROJECTIONS=false`) |
| 3 | Orphan modules | **NONE** |
| 4 | Duplicate responsibilities | **HIGH** | Query handlers read legacy Zustand state, not projections |
| 5 | Unnecessary abstractions | **LOW** |
| 6 | Legacy bypass | **CRITICAL** | Pages read `useStore` selectors directly |
| 7 | Feature flags | **PARTIAL** | `MIGRATION_QUERY_FACADE` unused |
| 13 | Every query has handler | **PASS** | 27/27 wired |
| 24 | Rollback safety | **OK** | Flag off → throws |

**F5 verdict:** Read path not cut over; shadow compare off.

---

### F6 — Projection Engine

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **PARTIAL** | Handler subscribed when `MIGRATION_PROJECTIONS=true`; scheduler 5-min |
| 2 | Dead code | **YES** | `runProjectionForEvent()`, `repairProjection()`, `repairAllProjections()` — zero callers |
| 3 | Orphan modules | **YES** | `projectionRunner.ts`, `projectionRepair.ts` (API only) |
| 4 | Duplicate responsibilities | **MEDIUM** | Projection stubs when flag off duplicate handler names |
| 5 | Unnecessary abstractions | **LOW** |
| 6 | Legacy bypass | **CRITICAL** | Projections not fed by UI writes |
| 7 | Feature flags | **OK** |
| 11 | Events consumed | **PARTIAL** | 16 projection types; missing `AccountCreated/Updated/Deleted`, `KhataEntryPosted` |
| 14 | Projections rebuildable | **PASS** | `fullReplay()`, `rebuildProjections()`, checkpoint resume |
| 15 | Replay correctness | **UNVERIFIED** | No golden CI (`MIGRATION_GOLDEN_CI=false`, unused) |
| 19 | Accounting invariants | **NOT GATED** | Parity diagnostic only |
| 20 | Inventory invariants | **NOT GATED** | Parity diagnostic only |
| 25 | Migration gates | **OK** | Additive Dexie v24 tables |

**F6 verdict:** Engine complete; data stale in production. VG-05 **FAILED**.

---

### F7 — Identity

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **PARTIAL** | `bootstrapIdentity()` via sync bootstrap + `getContextProvider()` |
| 2 | Dead code | **YES** | `getAuthorizationService()` — zero runtime callers |
| 3 | Orphan modules | **PARTIAL** | `authorization.ts` service |
| 4 | Duplicate responsibilities | **MEDIUM** | Legacy `syncEngine.ts` reads JWT independently of identity provider |
| 5 | Unnecessary abstractions | **LOW** |
| 6 | Legacy bypass | **HIGH** | Auth still via store; identity passive |
| 7 | Feature flags | **PARTIAL** | `MIGRATION_OIDC` unused — no OIDC implementation |
| 21 | Identity invariants | **PARTIAL** | JWT expiry check when flag on; tenant defaults to `"local"` |
| 24 | Rollback safety | **OK** | Flag off → null principal, legacy context fallback |

**F7 verdict:** Bootstrap present; authorization not enforced on commands/queries. VG-06 **FAILED**.

---

### F8 — Sync Platform

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **PARTIAL** | 30s scheduler via `bootstrapEventSync()` |
| 2 | Dead code | **YES** | `replayEventsForSync()` — zero callers |
| 3 | Orphan modules | **PARTIAL** | `syncReplay.ts` |
| 4 | Duplicate responsibilities | **CRITICAL** | Legacy `syncEngine.ts` (`syncOutbox`) parallel to `syncClient.ts` (`eventSyncQueue`) |
| 5 | Unnecessary abstractions | **LOW** |
| 6 | Legacy bypass | **HIGH** | `syncSubscriber` log-only; real sync scans event store |
| 7 | Feature flags | **PARTIAL** | `MIGRATION_DUAL_WRITE` unused; `MIGRATION_VECTOR_CLOCKS` logged not gated |
| 20 | Sync invariants | **FAIL** | Pull does not apply envelopes to Dexie; conflicts classified not merged |
| 16 | Idempotency | **PARTIAL** | Queue row overwrite; re-enqueue risk |
| 24 | Rollback safety | **OK** | `MIGRATION_EVENT_SYNC` off → client no-ops |

**F8 verdict:** Dual sync systems unresolved. VG-07 **FAILED**.

---

### F9 — Inventory Engine

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **PARTIAL** | Shadow handler on event bus when flag on |
| 2 | Dead code | **YES** | Adjustments, transfers, returns, reservations, reconciliation, period close — exported, uncalled |
| 3 | Orphan modules | **YES** | 8+ exported APIs with zero external callers |
| 4 | Duplicate responsibilities | **MEDIUM** | Shadow vs `stockValuation.ts` parity only |
| 5 | Unnecessary abstractions | **MEDIUM** | Scaffold modules ahead of event coverage |
| 6 | Legacy bypass | **CRITICAL** | UI writes bypass events; `StockAdjustment.tsx` writes Dexie directly |
| 7 | Feature flags | **OK** | `MIGRATION_INVENTORY_ENGINE`, `MIGRATION_INVENTORY_PARITY` |
| 11 | Events consumed | **PARTIAL** | Only `InvoicePosted`/`InvoiceUpdated`; no cancellation handling |
| 15 | Replay correctness | **MISSING** | No `inventoryReplay.ts` |
| 20 | Inventory invariants | **NOT GATED** | Parity diagnostic; disabled flag returns `passed: true` |
| 24 | Rollback safety | **OK** | Flag off → handler no-op |

**F9 verdict:** Shadow path correct when events flow; production starved.

---

### F10 — Accounting Engine

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **PARTIAL** | Shadow handler on voucher/invoice/TDS events |
| 2 | Dead code | **YES** | `replayAccountingFromEventStore`, `diagnoseAccountingState`, `repairShadowAccounting`, `allocateCostCenter` — no external callers |
| 3 | Orphan modules | **YES** | `accountingReplay.ts`, `accountingRepair.ts`, `costAllocationEngine.ts` |
| 4 | Duplicate responsibilities | **MEDIUM** | Shadow sagas vs legacy `accounting.ts` |
| 5 | Unnecessary abstractions | **LOW** |
| 6 | Legacy bypass | **CRITICAL** | Same as F2/F3 |
| 7 | Feature flags | **OK** | Engine, parity, replay flags |
| 11 | Events consumed | **PARTIAL** | TDS received but no saga branch; cancellations not reversed |
| 15 | Replay correctness | **PARTIAL** | Replay API exists, unwired; TDS/cancellations unwired in engine |
| 18 | Accounting invariants | **NOT GATED** | Parity compares legacy vs shadow; auto-pass when parity off |
| 17 | Transaction boundaries | **SHADOW ONLY** | In-memory `transactionBoundaryManager`; not atomic with Dexie |
| 24 | Rollback safety | **OK** |

**F10 verdict:** Shadow sagas functional on bus path. VG-08 **FAILED** (no atomic saga on production path).

---

### F11 — Report Engine

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **PARTIAL** | Bootstrap + 300s parity scheduler |
| 2 | Dead code | **YES** | `runReport`, `shouldUseProjectionReader`, `runReportPipeline` — zero external callers |
| 3 | Orphan modules | **YES** | Entire read API vs production |
| 4 | Duplicate responsibilities | **HIGH** | `reportingDomain` uses legacy adapters; `report-engine` unused |
| 5 | Unnecessary abstractions | **MEDIUM** | Full engine without cutover |
| 6 | Legacy bypass | **CRITICAL** | Pages use `useStore` + `@/lib/accounting` directly |
| 7 | Feature flags | **PARTIAL** | `MIGRATION_CQRS_REPORTS` unused; `MIGRATION_REPORT_CUTOVER=false` |
| 13 | Queries | **PASS** on bus | But bus reads legacy, not projections |
| 25 | Migration gates | **OK** | Cutover requires parity pass + flag |

**F11 verdict:** Parity infrastructure runs; no report cutover. VG-09 **FAILED**.

---

### F12 — NIOS Core

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **PARTIAL** | Bootstrap timers only |
| 2 | Dead code | **YES** | `processNiosRequest`, coordinator, registries — zero external callers |
| 3 | Orphan modules | **YES** | ~30 files; production uses `src/nios/client/niosClient.ts` → Python `erp_bot` |
| 4 | Duplicate responsibilities | **CRITICAL** | F12 `nios-core` parallel to `src/nios/client` + `erp_bot` |
| 5 | Unnecessary abstractions | **HIGH** | Full runtime with no consumers |
| 6 | Legacy bypass | **CRITICAL** | Live AI bypasses F12 entirely |
| 7 | Feature flags | **PARTIAL** | `MIGRATION_NIOS_COMMAND_GATE` unused |
| 22 | AI proposal safety | **PARTIAL** | `commandGateway.executeCommand` throws; gateway never called |
| 24 | Rollback safety | **OK** | Flag off → bootstrap no-op |

**F12 verdict:** Scaffold complete; production AI on legacy HTTP stack. F12→F13 bridge broken (dual proposal stores).

---

### F13 — AI Proposal Pipeline

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **PARTIAL** | 3 bootstraps; expire interval |
| 2 | Dead code | **YES** | `approveProposal`, `rejectProposal`, `executeApprovedProposal`, `executeAllApproved` — no callers |
| 3 | Orphan modules | **YES** | Full approval/execution surface unwired |
| 4 | Duplicate responsibilities | **HIGH** | F12 `proposalEngine` Map vs F13 `proposalRepository` |
| 5 | Unnecessary abstractions | **MEDIUM** |
| 6 | Legacy bypass | **CRITICAL** | `eKhataStore.confirmPending` → `confirmKhataEntry` → `useStore.addVoucher` |
| 7 | Feature flags | **OK** | Proposals on, approval on, **execution off** |
| 22 | AI proposal safety | **PARTIAL** | Execution gated; e-Khata bypasses pipeline |
| 24 | Rollback safety | **OK** | Execution off → no AI writes |

**F13 verdict:** Pipeline exists; no UI, no execution, khata bypass. VG-10 **FAILED**.

---

### F14 — Plugin SDK & Microkernel

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Files connected to runtime | **PARTIAL** | Bootstrap loads 2 builtin manifests to `LOADED` state |
| 2 | Dead code | **YES** | SDK, activation, hooks, isolation, extension points — no consumers |
| 3 | Orphan modules | **YES** | 38 files; only bootstrap + installer path live |
| 4 | Duplicate responsibilities | **LOW** | F14 `pluginHost` vs F12 `nios-core/pluginHost.ts` (both unused) |
| 5 | Unnecessary abstractions | **MEDIUM** | Marketplace-ready scaffold without activation |
| 6 | Legacy bypass | **OK** | No plugin routing; legacy pages unchanged |
| 7 | Feature flags | **PARTIAL** | `MIGRATION_PLUGINS` (routing) unused |
| 23 | Plugin isolation | **FAIL** | `blockDirectStoreAccess`/`blockDirectDexieAccess` empty stubs; `isForbiddenApi` never called at load |
| 24 | Rollback safety | **OK** | Kernel/SDK/sandbox flags independent |

**F14 verdict:** Infrastructure present; plugins inert. VG-11 **FAILED**.

---

## Complete Dependency Audit

### Intended direction (SYSTEM-06/09)

```
UI → Domain Facades → Command Bus → Legacy Adapters → Dexie
                    → Event Bus → Event Store → Projections
                    → Query Bus → Projections (target) / Legacy (current)
Domains → Platform (buses, flags, kernel contracts)
Platform ↛ Domains (except composition root)
```

### Actual direction

```
UI → useStore → Dexie                    [PRODUCTION PATH]
Domain Facades → Command Bus → Legacy    [DORMANT — no UI callers]
Command Bus → Event Bus → Event Store    [DORMANT — no UI commands]
Event Bus bootstrap → F9–F14 bootstraps  [INVERSION]
src/nios/client → erp_bot Python         [PRODUCTION AI — bypasses F12/F13]
syncEngine.ts (legacy) ∥ syncClient.ts   [DUAL SYNC]
```

### Import graph violations

| From | To | Severity |
|------|-----|----------|
| `platform/event-bus/bootstrap.ts` | `domains/inventory-engine`, `accounting-engine`, `report-engine`, `nios-core`, `ai-proposal`, `plugin-kernel` | **HIGH** — platform depends on domains |
| `platform/context/zustandContextProvider.ts` | `@/store` | **MEDIUM** — expected during migration |
| `platform/identity/authentication.ts` | `@/store` | **MEDIUM** |
| `platform/projections/handlers/projectionHandlers.ts` | `@/lib/db` | **MEDIUM** — direct Dexie in projection layer |
| `legacy/adapters/legacyStoreAdapter.ts` | `@/store` | **OK** — adapter boundary |

### Module import cycle (confirmed)

```
event-bus/bootstrap.ts
  → domains/ai-proposal/index.ts (barrel)
    → commandExecutionService.ts
      → command-bus/dispatch.ts
        → publishFromCommand.ts
          → event-bus/bootstrap.ts
```

**Mitigation today:** lazy `getEventBus()` at runtime. **Risk:** top-level side effects will break bundler/initialization.

### tsconfig path aliases — runtime usage

| Alias | Imported at runtime |
|-------|---------------------|
| `@fios/kernel` | Yes — buses, domains |
| `@fios/command-bus` | Yes — dispatch, domains |
| `@fios/event-bus` | Yes — types, publish |
| `@fios/event-store` | Yes — middleware, projections |
| `@fios/query-bus` | Yes — reportingDomain, domains |
| `@fios/projections` | Yes — projection engine |
| `@fios/identity` | Yes — sync, context |
| `@fios/sync` | Yes — bootstrap |
| `@fios/legacy` | Yes — adapters, query handlers |
| `@fios/domains` | **No** |
| `@fios/inventory-engine` | **No** |
| `@fios/accounting-engine` | **No** |
| `@fios/report-engine` | **No** |
| `@fios/nios-core` | **No** |
| `@fios/ai-proposal` | **No** (only `@/domains/ai-proposal` from bootstrap) |
| `@fios/plugin-kernel` | **No** |
| `@fios/platform` | **No** |

---

## Runtime Integration Audit

### Bootstrap chain

| Component | Trigger | Eager at app start? |
|-----------|---------|---------------------|
| Event Bus + all subscribers | First `executeCommand` → `publishEventsForCommand` | **No** |
| Command Bus handlers | First `executeCommand` | **No** |
| Query Bus handlers | First `executeQuery` | **No** |
| Identity | `getContextProvider()` or sync bootstrap | **Lazy** (on event bus init) |
| Sync scheduler (30s) | `bootstrapEventSync()` inside event bus | **Lazy** |
| Projection scheduler (5min) | `bootstrapProjections()` | **Lazy** |
| F9 parity (5min) | `bootstrapInventoryEngine()` | **Lazy** |
| F10 parity (5min) | `bootstrapAccountingEngine()` | **Lazy** |
| F11 parity (5min) | `bootstrapReportEngine()` | **Lazy** |
| F12 health (5min) | `bootstrapNiosCore()` | **Lazy** |
| F13 expire job | `bootstrapApprovalPipeline()` | **Lazy** |
| F14 health (5min) | `bootstrapPluginKernel()` | **Lazy** |

**Gap:** Until first command publish, F9–F14 bootstraps never run. No `getEventBus()` in `main.tsx` or `App.tsx`.

### Production traffic paths

| Operation | Path used | New architecture involved? |
|-----------|-----------|---------------------------|
| Post invoice | `SalesInvoiceForm` → `useStore.addInvoice` | **No** |
| Post voucher | `JournalVoucherForm` → `useStore.addVoucher` | **No** |
| POS sale | `POSBilling` → `store.addInvoice` (no await) | **No** |
| Stock adjustment | `StockAdjustment` → direct `db.stockMovements` | **No** |
| Khata confirm | `eKhataStore` → `confirmKhataEntry` → `addVoucher` | **No** |
| Reports | Pages → `useStore` + `@/lib/accounting` | **No** |
| AI chat | `NiosShell` → `niosClient` → `erp_bot` | **No** (F12/F13) |
| Domain facade write | `voucherDomain.post` → `executeCommand` | **Dormant** |
| Plugin command | `pluginExecuteCommand` | **Dormant** |
| AI execution | `executeApprovedProposal` | **Blocked** (`MIGRATION_AI_EXECUTION=false`) |

### `executeCommand` call sites (entire `src/`)

Only 21 files reference `executeCommand`; none are `src/pages` or `src/components` (except indirectly via store slices). Callers: domain facades, plugin-kernel, ai-proposal execution, nios domain, sync domain.

### `executeQuery` call sites

Used in domain facades and `reportingDomain` only. **Zero** `src/pages` imports.

---

## Dead-Code Report

### Platform layer

| Symbol | File | Reason |
|--------|------|--------|
| `bootstrapEventStore()` | `event-store/bootstrap.ts` | Zero callers |
| `runEventMigrations()` | `event-store/migration.ts` | Zero callers |
| Snapshot/compaction APIs | `eventSnapshots.ts`, `eventCompaction.ts` | Stubs, unused |
| `runProjectionForEvent()` | `projections/projectionRunner.ts` | Zero callers |
| `repairProjection()`, `repairAllProjections()` | `projections/projectionRepair.ts` | Zero callers |
| `replayEventsForSync()` | `sync/syncReplay.ts` | Zero callers |
| `onLegacyDomainEvent()` | `event-bus/legacyBridge.ts` | Zero callers |
| `getAuthorizationService()` | `identity/authorization.ts` | Zero callers |
| `@fios/platform` barrel | `platform/index.ts` | Zero imports |

### F9 inventory-engine

`buildAdjustmentMovement`, `buildTransferMovements`, `classifyReturnKind`, `buildOpeningEvent`, `buildClosingEvent`, `closeInventoryPeriod`, reservation APIs, `runReconciliation`, `shutdownInventoryEngine`

### F10 accounting-engine

`replayAccountingFromEventStore`, `dryRunReplay`, `rebuildFromCheckpoint`, `diagnoseAccountingState`, `repairShadowAccounting`, `allocateCostCenter`, `shutdownAccountingEngine`

### F11 report-engine

`runReport`, `shouldUseProjectionReader`, `runReportPipeline`, export/repair/replay APIs (self-referential only)

### F12 nios-core

`processNiosRequest`, `coordinateAgents`, `registerAgent/Workflow/Skill`, `recoverNiosCore`, `shutdownNiosCore`, entire coordinator/runtime public API

### F13 ai-proposal

`approveProposal`, `rejectProposal`, `executeApprovedProposal`, `executeAllApproved`, `replayProposalsFromSnapshots`, `runProposalMaintenance`, `shutdownApprovalPipeline`

### F14 plugin-kernel

`createPluginSDK`, `hostActivatePlugin`, `activatePlugin`, `subscribePluginToEvents` (via SDK), `isolatePlugin`, `registerExtensionPoint`, `updatePlugin`, `uninstallPlugin`, `recoverPluginKernel`, `testPluginManifest`, sandbox block functions (empty stubs)

### Event-bus subscribers (functional dead code)

`notificationSubscriber`, `niosSubscriber`, `syncSubscriber` — named for side effects; implementation is log-only.

---

## Orphan-File Report

Files or modules that exist per SYSTEM-08/09 spec but have **no inbound runtime reference** from production paths:

| Category | Count | Examples |
|----------|-------|---------|
| Domain facades (F1) | 18 | `src/domains/voucher/index.ts`, etc. |
| Engine public APIs (F9–F11) | 40+ | replay, repair, reconciliation modules |
| NIOS core runtime (F12) | ~30 | `src/domains/nios-core/niosRuntime.ts` |
| AI approval UI surface (F13) | 15+ | approval queue, notifications (no trigger) |
| Plugin SDK consumers (F14) | 35+ | all SDK entry points |
| Platform operational APIs | 8 | repair, replay, migration runners |
| tsconfig aliases | 7 | `@fios/domains`, `@fios/*-engine` |
| Legacy dead components | 3 | `StockItems.tsx`, `PurchaseInvoiceForm.tsx`, `ReturnInvoiceForm.tsx` (pre-existing) |

---

## Layer-Violation Report

| ID | Violation | Severity | Location |
|----|-----------|----------|----------|
| LV-01 | Platform bootstrap imports domain engines F9–F14 | **HIGH** | `event-bus/bootstrap.ts` |
| LV-02 | Module import cycle bootstrap ↔ ai-proposal | **HIGH** | See §Dependency Audit |
| LV-03 | Projection handlers write via `@/lib/db` directly | **MEDIUM** | `projectionHandlers.ts` |
| LV-04 | UI writes bypass all platform layers | **CRITICAL** | `src/pages/**`, `src/components/**` |
| LV-05 | e-Khata bypasses proposal pipeline | **HIGH** | `eKhataStore.ts`, `confirmKhata.ts` |
| LV-06 | Production AI bypasses F12/F13 | **HIGH** | `src/nios/client/niosClient.ts` |
| LV-07 | Dual sync systems without reconciliation | **HIGH** | `syncEngine.ts` vs `syncClient.ts` |
| LV-08 | Plugin sandbox policy not enforced | **MEDIUM** | `pluginSandbox.ts`, `pluginSecurity.ts` |
| LV-09 | Authorization service not on dispatch path | **MEDIUM** | `command-bus/dispatch.ts` |
| LV-10 | `StockAdjustment` direct Dexie write | **MEDIUM** | `StockAdjustment.tsx` |

**No violation found:** Plugin SDK correctly routes through buses when called. Command/query handler registration is complete.

---

## Missing Registration Report

### Events

| Event | Published? | Missing consumer |
|-------|-----------|------------------|
| `HandlerFailed` | **Never published** | Publisher in `eventDispatcher.ts` |
| `AccountCreated` | Yes | Projection handler |
| `AccountUpdated` | Yes | Projection handler |
| `AccountDeleted` | Yes | Projection handler |
| `KhataEntryPosted` | Yes | Projection + engine consumer |
| `TdsEntryAdded/Updated` | Yes | Accounting shadow saga branch |
| `VoucherCancelled` | Yes | Accounting/inventory reversal |
| `InvoiceCancelled` | Yes | Accounting/inventory reversal |
| `NotificationAdded/Read/Cleared` | Yes | `notificationSubscriber` excludes them |

### Commands

**None missing.** 24/24 registered.

### Queries

**None missing on platform bus.** AI RAG handlers in `src/ai/rag/*` are a separate layer, not registered on `SyncQueryBus`.

### Extension points (F14)

Registered in code but **zero runtime registrations** from plugins.

---

## Missing Bootstrap Report

| Expected bootstrap | Status |
|--------------------|--------|
| App-level platform init | **MISSING** — no eager `getEventBus()` at startup |
| `bootstrapEventStore()` | **MISSING** — lazy via middleware only |
| F12 `processNiosRequest` wiring to UI | **MISSING** |
| F13 approval UI bootstrap | **MISSING** |
| F14 plugin activation after install | **MISSING** — install stops at `LOADED` |
| F10 accounting replay on boot | **MISSING** (optional per spec) |
| Authorization on command dispatch | **MISSING** |
| `MIGRATION_DUAL_WRITE` coordinator | **MISSING** — flag undefined |
| OIDC provider | **MISSING** — flag only |
| Golden CI parity runner | **MISSING** — flag only |

---

## Missing Feature-Flag Report

Flags defined in `registry.ts` with **zero runtime references** outside the registry itself:

| Flag | Documented purpose | Status |
|------|-------------------|--------|
| `MIGRATION_DUAL_WRITE` | Coordinated legacy + event write | **UNIMPLEMENTED** |
| `MIGRATION_QUERY_FACADE` | Query facade routing | **UNIMPLEMENTED** |
| `MIGRATION_CQRS_REPORTS` | F11 report cutover rollback | **UNIMPLEMENTED** |
| `MIGRATION_NIOS_COMMAND_GATE` | F13 AI command gate | **UNIMPLEMENTED** |
| `MIGRATION_PLUGINS` | F14 route registry cutover | **UNIMPLEMENTED** |
| `MIGRATION_OIDC` | OIDC auth | **UNIMPLEMENTED** |
| `MIGRATION_STRUCTURED_ERRORS` | Error envelope | **UNIMPLEMENTED** |
| `MIGRATION_CORRELATION_IDS` | Correlation middleware always on regardless | **UNIMPLEMENTED** |
| `MIGRATION_GOLDEN_CI` | Golden fixture CI | **UNIMPLEMENTED** |
| `MIGRATION_DOMAIN_FACADES` | UI facade routing | **UNIMPLEMENTED** |

Flags correctly implemented: all others (30/40).

---

## Missing Diagnostics Report

| Engine | Diagnostics module | Wired to runtime? | Actionable alerts? |
|--------|-------------------|-------------------|-------------------|
| Event bus | `eventDiagnostics.ts` | Yes (middleware) | Log only |
| Command bus | `commandDiagnostics.ts` | Yes | Log only |
| Query bus | `queryDiagnostics.ts` | Yes | Log only |
| Projections | `projectionDiagnostics.ts` | Yes | Log only |
| Sync | `syncDiagnostics.ts` | Yes | Log only |
| Identity | `identityDiagnostics.ts` | Yes | Log only |
| F9 inventory | `inventoryDiagnostics.ts` | Yes (parity) | No blocking |
| F10 accounting | `accountingDiagnostics.ts` | Yes (parity) | No blocking |
| F11 report | `reportDiagnostics.ts` | Yes (parity) | Cutover rollback only |
| F12 nios | `diagnostics.ts` | Yes (health interval) | No consumers |
| F13 proposal | `proposalDiagnostics.ts` | Yes | No UI |
| F14 plugin | `pluginDiagnostics.ts` | Yes (health interval) | No consumers |

**Gap:** Parity failures are recorded but do not block writes, cutover (except F11 auto-rollback), or alert operators.

---

## Missing Tests Report

| Area | Unit tests | Integration tests | Golden/parity CI |
|------|-----------|-------------------|------------------|
| Platform (F0–F8) | **0** | **0** | **0** |
| Domain facades (F1) | **0** | **0** | **0** |
| Inventory engine (F9) | **0** | **0** | Parity scheduler only |
| Accounting engine (F10) | **0** | **0** | Parity scheduler only |
| Report engine (F11) | **0** | **0** | Parity scheduler only |
| NIOS core (F12) | **0** | **0** | **0** |
| AI proposal (F13) | **0** | **0** | **0** |
| Plugin kernel (F14) | **0** | **0** | `testPluginManifest` unwired |
| Legacy ERP | **0** in main app | **1** e2e (`e2e/ekhata-panel.spec.ts`) | **0** |
| khata-app (separate) | 4 tests | — | — |

**SYSTEM-07 VG-01 (golden fixtures) — FAILED.** `MIGRATION_GOLDEN_CI` unused.

---

## Production Blockers

These must be resolved before any production cutover (F15):

| # | Blocker | Phase | SYSTEM-05 ref |
|---|---------|-------|---------------|
| PB-01 | **100% UI writes bypass Command Bus** — shadow engines starved | F2/F3 | W-001, W-055 |
| PB-02 | **Dual sync systems** without authoritative layer | F8 | W-039, W-050 |
| PB-03 | **e-Khata direct ERP write** bypasses AI proposal pipeline | F13 | W-106, W-094 |
| PB-04 | **Event store empty in production** — no command→event on UI path | F4 | W-055 |
| PB-05 | **Projections stale** — cannot serve reads | F6 | W-021 |
| PB-06 | **Authorization not enforced** on commands/queries | F7 | W-091, W-092 |
| PB-07 | **No golden/parity CI gate** blocking release | F6/F11 | VG-01, VG-05, VG-09 |
| PB-08 | **Production AI on legacy HTTP stack** — F12/F13 unused | F12/F13 | W-103 |
| PB-09 | **Plugin sandbox not enforced** — same JS bundle | F14 | AD-12 |
| PB-10 | **Conflict resolution does not apply merges** to local state | F8 | W-050 |
| PB-11 | **Event sync pull does not replay** into Dexie | F8 | W-042, W-043 |
| PB-12 | **Validation gates VG-03 through VG-11 all failed** | All | SYSTEM-07 |

---

## High-Risk Issues

| ID | Issue | Impact |
|----|-------|--------|
| HR-01 | Command bus is legacy-store passthrough, not a new write model | Migration provides false confidence |
| HR-02 | Parity disabled returns `{ passed: true }` | Silent false confidence on rollback |
| HR-03 | `POSBilling` fire-and-forget writes with swallowed errors | Data loss risk |
| HR-04 | `confirmKhataEntry` nested Dexie transactions | Unclear rollback semantics |
| HR-05 | Import cycle `bootstrap ↔ ai-proposal` | Fragile initialization |
| HR-06 | F12 and F13 maintain separate proposal stores | Broken AI governance model |
| HR-07 | `MIGRATION_AI_EXECUTION=false` but khata writes anyway | AI safety boundary violated |
| HR-08 | Tenant ID hardcoded `"local"` in projections/event store | Multi-tenant risk |
| HR-09 | Command idempotency in-memory only | Duplicate commands after reload |
| HR-10 | 107 orphan pages still on string routing (W-172) | F14 not engaged |

---

## Medium-Risk Issues

| ID | Issue | Impact |
|----|-------|--------|
| MR-01 | Event-bus subscribers are observability stubs | Misleading module names |
| MR-02 | Accounting shadow missing TDS sagas and cancellation reversals | Incomplete shadow |
| MR-03 | Inventory shadow missing cancellation handling | Incomplete shadow |
| MR-04 | No `inventoryReplay.ts` | Cannot rebuild shadow inventory |
| MR-05 | `reportingDomain` uses query bus but pages don't | Dead integration layer |
| MR-06 | 10 feature flags defined but unimplemented | Operator confusion |
| MR-07 | `bootstrapEventStore()` never called explicitly | Operational ambiguity |
| MR-08 | Projection repair/rebuild APIs orphaned | No ops tooling wired |
| MR-09 | F14 plugins loaded but never activated | Lifecycle incomplete |
| MR-10 | `StockAdjustment` bypasses inventory slice valuation | Invariant drift |
| MR-11 | Legacy `syncEngine` JWT read independent of identity provider | Auth inconsistency |
| MR-12 | `HandlerFailed` event type registered but never published | Incomplete failure model |

---

## Low-Risk Issues

| ID | Issue | Impact |
|----|-------|--------|
| LR-01 | `@fios/platform` barrel unused | Cleanup candidate |
| LR-02 | Event snapshot/compaction stubs | Future F4+ work |
| LR-03 | F12 `pluginHost.ts` duplicates F14 | Naming confusion |
| LR-04 | Shutdown hooks exported but never called | Graceful shutdown gap |
| LR-05 | `MIGRATION_VECTOR_CLOCKS` logged not gated | Flag semantics unclear |
| LR-06 | `queryShadow.ts` off by default | Shadow read compare inactive |
| LR-07 | Builtin plugin manifests have no executable entrypoints | Expected for scaffold phase |
| LR-08 | `legacyBridge.onLegacyDomainEvent` unused | Bridge incomplete |
| LR-09 | Dead form components (StockItems, PurchaseInvoiceForm, ReturnInvoiceForm) | Pre-existing debt |
| LR-10 | No structured error envelope (`MIGRATION_STRUCTURED_ERRORS` unused) | DX only |

---

## Required Fixes Before Production

Ordered by dependency; no new architecture — wiring and gating only:

1. **Route all UI writes through `executeCommand`** (or domain facades) — unblocks F2–F4–F6–F9–F10
2. **Implement `MIGRATION_DOMAIN_FACADES` gate** — enforce facade usage from pages
3. **Block e-Khata direct `confirmKhataEntry`** — route through F13 proposal pipeline; wire `MIGRATION_NIOS_COMMAND_GATE`
4. **Unify sync** — choose authoritative path (`syncClient` or legacy `syncEngine`); implement pull→Dexie replay
5. **Wire `getAuthorizationService()` into command/query dispatch**
6. **Publish `HandlerFailed`** from `eventDispatcher.ts` on handler failures
7. **Add projection handlers** for `AccountCreated/Updated/Deleted`, `KhataEntryPosted`
8. **Complete accounting shadow sagas** for TDS and cancellations
9. **Wire F12 `processNiosRequest` to replace or wrap `niosClient`** — single AI entry
10. **Bridge F12 proposals → F13 `submitProposal`** — eliminate dual stores
11. **Add approval UI** for F13 before enabling `MIGRATION_AI_EXECUTION`
12. **Activate F14 plugins** after install; wire `MIGRATION_PLUGINS` route registry
13. **Enforce plugin sandbox** at load (`isForbiddenApi` + bundle isolation)
14. **Make parity failures block cutover flags** (not just F11)
15. **Add golden CI** (`MIGRATION_GOLDEN_CI`) with VG-01 fixtures
16. **Eager platform bootstrap** in `main.tsx` — `getEventBus()` at startup
17. **Break import cycle** — bootstrap imports `*Bootstrap.ts` files only, not `ai-proposal` barrel
18. **Persist command idempotency** to Dexie
19. **Implement `MIGRATION_DUAL_WRITE`** or formally deprecate legacy sync
20. **Connect F11 `runReport` to `reportingDomain`** before `MIGRATION_REPORT_CUTOVER=true`

---

## Remaining Technical Debt

| Debt ID | Description | Origin | Target phase |
|---------|-------------|--------|--------------|
| TD-MIG-01 | UI strangler not started | F1/F2 | F15 |
| TD-MIG-02 | 10 unimplemented feature flags | F0 | F15 |
| TD-MIG-03 | Platform→domain bootstrap inversion | F3 | F15 refactor |
| TD-MIG-04 | Dual AI stacks (erp_bot vs nios-core) | F12 | F15 |
| TD-MIG-05 | Dual proposal stores | F12/F13 | F15 |
| TD-MIG-06 | Dual sync systems | F8 | F15 |
| TD-MIG-07 | 40+ orphan engine APIs | F9–F14 | Incremental |
| TD-MIG-08 | Zero platform unit tests | F0 | F15 |
| TD-MIG-09 | String routing (107 orphan pages) | Pre-existing W-172 | F14 cutover |
| TD-MIG-10 | Parity-off auto-pass semantics | F9/F10 | F15 |
| TD-MIG-11 | Notification/nios/sync subscribers non-functional | F3 | F15 |
| TD-MIG-12 | Import cycle bootstrap↔ai-proposal | F13 | F15 |
| TD-MIG-13 | Tenant hardcoded `"local"` | F4/F6 | F7+ |
| TD-MIG-14 | OIDC not implemented | F7 | Post-F15 |
| TD-MIG-15 | Event snapshot/compaction stubs | F4 | Post-F15 |

---

## Validation Gate Status (SYSTEM-07 VG-01 – VG-11)

| Gate | Phase | Criterion | Status |
|------|-------|-----------|--------|
| VG-01 | F0 | Golden fixtures pass | **FAIL** |
| VG-02 | F1 | Zero new circular imports | **FAIL** (bootstrap↔ai-proposal) |
| VG-03 | F2 | 100% writes via bus | **FAIL** |
| VG-04 | F4 | Command→event 1:1 | **FAIL** (UI path) |
| VG-05 | F6 | Projection = accounting.ts | **FAIL** (stale data) |
| VG-06 | F7 | Sync pull with JWT; 401 without | **FAIL** |
| VG-07 | F8 | Multi-device no silent loss | **FAIL** |
| VG-08 | F10 | Invoice post atomic or compensated | **FAIL** (legacy path) |
| VG-09 | F11 | All report types match goldens | **FAIL** |
| VG-10 | F13 | Zero unapproved AI writes | **FAIL** (khata bypass) |
| VG-11 | F14 | Core ERP via plugins only | **FAIL** |

**Gates passed: 0 / 11**

---

## SYSTEM-05 Weakness Traceability

| Weakness | Verification finding | Blocked by |
|----------|---------------------|------------|
| W-001 God store | UI still uses monolithic `useStore` for all writes | PB-01 |
| W-021 Triple balance truth | Projections stale; shadow engines not fed | PB-04, PB-05 |
| W-039 Sync token never set | Dual sync; event sync pull incomplete | PB-02, PB-11 |
| W-044 No versioning | Event versioning exists; plugins have versioning; not on UI path | F14 only |
| W-050 Server LWW | Conflict engine classifies but does not merge | HR-10 |
| W-055 Dual persistence | Legacy Dexie + event store not coordinated | PB-04, `MIGRATION_DUAL_WRITE` missing |
| W-091 NIOS open API | F12 gateway exists but production uses open `erp_bot` HTTP | PB-08 |
| W-092 Tenant spoof | Tenant hardcoded `"local"`; authz not enforced | HR-08, PB-06 |
| W-094 Capability exec open | e-Khata bypasses proposal gate | PB-03 |
| W-103 Four AI stacks | F12 + erp_bot + orbix + self-contained AI parallel | PB-08 |
| W-106 AI posted disconnect | Khata confirms directly to voucher | PB-03 |
| W-172 String routing | `MIGRATION_PLUGINS` unused; 107 orphan pages | PB-12, HR-10 |
| AD-12 107 orphan pages | Plugin registry exists; no route cutover | F14 incomplete |
| AD-01 Four AI stacks | nios-core unused at runtime | PB-08 |
| C-07/C-08 Modularity | Facades and engines exist but unwired | PB-01 |

---

## Exact Checklist Before F15 Production Cutover

### Write path

- [ ] Every `src/pages` and `src/components` write calls `executeCommand` or a domain facade — zero direct `useStore.addVoucher`/`addInvoice`/`setState` for domain mutations
- [ ] `MIGRATION_DOMAIN_FACADES` enforced with runtime guard in store slices (reject direct mutation when flag on)
- [ ] `eKhataStore.confirmPending` routes through F13 `submitProposal` → approval → conditional `executeCommand`
- [ ] `MIGRATION_NIOS_COMMAND_GATE` implemented and default `true` before cutover
- [ ] `StockAdjustment`, `POSBilling`, `AuditLog` direct Dexie/`setState` paths eliminated

### Event and store path

- [ ] `getEventBus()` called eagerly at app bootstrap
- [ ] Command→event 1:1 verified on all 24 command types under load test
- [ ] Event store contains production traffic (non-empty `domainEvents` after normal session)
- [ ] `HandlerFailed` published on command handler failures
- [ ] `MIGRATION_DUAL_WRITE` implemented OR legacy `syncEngine` formally deprecated

### Read path

- [ ] `reportingDomain` used by all report pages OR `MIGRATION_REPORT_CUTOVER=true` with parity pass
- [ ] `MIGRATION_SHADOW_PROJECTIONS=true` during cutover rehearsal; zero drift for 7 days
- [ ] Query bus reads from projections, not legacy state, when `MIGRATION_CQRS_REPORTS=true`

### Projection and parity

- [ ] Account and Khata projection handlers added
- [ ] `MIGRATION_GOLDEN_CI=true` in CI; VG-01 fixtures pass
- [ ] F9/F10/F11 parity passes continuously for 7 days with parity flag on
- [ ] Parity-off no longer returns `passed: true` — returns `skipped` status instead
- [ ] `repairProjection` / `replayAccountingFromEventStore` wired to ops tooling

### Sync and identity

- [ ] Single authoritative sync path chosen and documented
- [ ] Event sync pull replays envelopes into Dexie
- [ ] `getAuthorizationService()` enforces permissions on command/query dispatch
- [ ] JWT required for sync pull; 401 without valid token (VG-06)
- [ ] Conflict resolution applies merge winner to local state

### AI and plugins

- [ ] Production AI routed through F12 `processNiosRequest` or F12 gateway wraps `niosClient`
- [ ] F12 proposals bridge to F13 single store
- [ ] Approval UI wired; `MIGRATION_AI_EXECUTION=true` only after VG-10 sign-off
- [ ] F14 plugins activated after install; `MIGRATION_PLUGINS=true` routes pages
- [ ] Plugin sandbox enforced (forbidden API check at load; bundle isolation)
- [ ] `isForbiddenApi` blocks `useStore`/`getDB` imports in plugin loader

### Architecture hygiene

- [ ] Import cycle `bootstrap ↔ ai-proposal` broken
- [ ] Platform bootstrap does not import domain barrels with dispatch dependencies
- [ ] Command idempotency persisted across reload
- [ ] All 10 previously unimplemented flags either implemented or removed from registry
- [ ] Shutdown hooks called on app unload

### Validation gates

- [ ] VG-01 through VG-11 all **PASS**
- [ ] SYSTEM-07 cutover checklist (section 07.39) signed off
- [ ] No P0 weaknesses open per SYSTEM-05 P0 list
- [ ] Release readiness score ≥ 85

---

## Document Control

| Field | Value |
|-------|-------|
| Document | SYSTEM-15 |
| Version | 1.0 |
| Supersedes | — |
| References | SYSTEM-05, SYSTEM-06, SYSTEM-07, SYSTEM-08, SYSTEM-09, F0–F14 implementations |
| Next action | F15 — Production cutover (blocked until checklist complete) |
| Audit method | Static analysis + runtime wiring trace (2026-07-10) |
