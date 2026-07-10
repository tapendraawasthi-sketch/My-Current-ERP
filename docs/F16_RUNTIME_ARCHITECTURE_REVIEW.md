# F16: Runtime Architecture Review

**Date:** 2026-07-10  
**Reviewer:** Principal Software Architect (NIOS)  
**Scope:** Post-F15 stabilization — runtime architecture only  
**Current operational readiness:** 72/100 (SYSTEM-16)  
**Reference runtime:**

```
UI → Facade Write Router → Domain Facades → Command Bus → Write Internals → Dexie
                                                              ↓
                                                         Event Bus → Shadow Projections
                                                              ↓
                                                         Query Bus (reads + shadow compare)
```

---

## Executive Summary

The F15 cutover successfully connected the CQRS scaffolding to production writes for 20 command-mapped operations. The runtime is **functionally wired** but **architecturally immature** for scaling into a multi-domain Financial Intelligence Operating System.

**Strengths:** Clear write path through buses; recursion guard on commands; event publication after accepted commands; shadow engines fed; feature-flag rollback preserved; eager platform bootstrap.

**Critical weaknesses:** Query facade introduces **infinite query recursion** when enabled; dual authority (Zustand hydration + Query Bus) on reads; platform bootstrap inverts dependency direction (platform imports domains); in-memory idempotency; hardcoded `tenantId: "local"`; projection lock is process-local only; plugin sandbox is policy-only; ~80% of store writes still bypass the bus; sync pull does not apply remote state.

**Verdict:** The runtime is a **connected strangler**, not yet a **production-grade intelligence kernel**. Stabilization must focus on eliminating recursion, establishing single read authority, hardening transaction and tenant boundaries, and decoupling the composition root — before any distributed or multi-company expansion.

**Architecture Score: 58/100** (structural integrity, separate from operational readiness 72/100)

---

## Architecture Score Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Coupling | 45 | Store↔platform↔domain triangle; event-bus owns domain bootstraps |
| Cyclic dependencies | 50 | F15 broke ai-proposal barrel cycle; query recursion remains |
| Hidden state | 40 | Zustand + Dexie + in-memory idempotency + shadow engines |
| Transaction boundaries | 55 | Dexie tx in slices; no bus-level unit of work |
| Event consistency | 65 | 1 domain event per command; 2 publishes (meta + domain) |
| Command consistency | 70 | Idempotency in-memory; context guard works |
| Query consistency | 35 | **Recursion bug**; reads still from Zustand |
| Plugin isolation | 30 | Same bundle; empty sandbox stubs |
| Runtime extensibility | 55 | Extension points registered; no route cutover |
| Testability | 25 | Zero platform unit tests; global singletons |
| Performance | 60 | Sync command bus; sequential event handlers |
| Failure recovery | 50 | DLQ exists; no projection repair wiring |
| Observability | 65 | Diagnostics modules exist; no alerting |
| Capability evolution | 50 | Plugin kernel inert for routing |
| Multi-company isolation | 25 | `tenantId: "local"` hardcoded |
| Offline-first guarantees | 70 | Dexie authoritative; event sync partial |
| Distributed execution readiness | 30 | No partition keys; no durable idempotency |

**Weighted Architecture Score: 58/100**

---

## Component Reviews

### 1. Command Bus

| Aspect | Assessment |
|--------|------------|
| **Current responsibilities** | Dispatch 24 command types; in-memory idempotency by `commandId`; publish events on accept; register legacy handlers delegating to write internals |
| **Should move elsewhere** | Event publication → outbox or transactional emitter; idempotency → Dexie/event-store table |
| **Missing** | Authorization gate; durable idempotency; command versioning enforcement; unit-of-work boundary; correlation propagation to slices |
| **SOLID violations** | **SRP:** dispatch + publish + envelope creation in one module. **DIP:** handlers depend on concrete legacy adapters |
| **Hidden coupling** | `dispatch.ts` imports `@/store/commandBusContext` — platform depends on store layer |
| **Scalability** | `SyncCommandBus` blocks UI thread; no command queue; no partition by tenant/aggregate |
| **Risk** | **Medium** |
| **Recommended refactor** | Extract `CommandPipeline` (validate → authorize → dispatch → emit); persist idempotency to Dexie; remove store import via kernel callback injection |
| **Backward compatibility** | Keep `executeCommand()` signature; add optional `commandId` for callers; flag-gate durable idempotency |

---

### 2. Query Bus

| Aspect | Assessment |
|--------|------------|
| **Current responsibilities** | Dispatch 27 query types; sync handlers reading legacy state; shadow compare after read |
| **Should move elsewhere** | Shadow compare → dedicated parity service, not inline in dispatcher |
| **Missing** | Query context guard (like command); projection-backed read path; cache layer; query recursion prevention |
| **SOLID violations** | **SRP:** dispatcher + shadow compare. **LSP:** `createLegacyStateReader` with QUERY_FACADE breaks handler contract |
| **Hidden coupling** | Handlers use module-level `createLegacyStateReader()` which calls back into query bus when `MIGRATION_QUERY_FACADE=true` |
| **Scalability** | All reads resolve to Zustand arrays; no pagination; full list scans |
| **Risk** | **High** — query recursion when `MIGRATION_QUERY_FACADE=true` |
| **Recommended refactor** | Split `readLegacyState()` (direct Zustand) from `readQueryFacade()` (bus); handlers must use direct reader only; add `isInQueryBusContext` guard |
| **Backward compatibility** | `MIGRATION_QUERY_FACADE` routes domain facade `.list()` only; handlers use `readLegacyState()` always |

**Query recursion path (confirmed):**
```
executeQuerySync(LIST_VOUCHERS)
  → handler: state.getVouchers()
    → createLegacyStateReader [QUERY_FACADE=true]: executeQuerySync(LIST_VOUCHERS)
      → ∞
```

---

### 3. Event Bus

| Aspect | Assessment |
|--------|------------|
| **Current responsibilities** | Publish domain events; middleware pipeline; subscriber registry; wildcard handlers for audit/notification/nios/sync; bootstrap 6 domain engines on init |
| **Should move elsewhere** | Domain engine bootstraps → composition root / `platformBootstrap.ts`; subscriber side-effects → real handlers or remove |
| **Missing** | `HandlerFailed` publication; subscriber ordering guarantees; backpressure; event versioning enforcement at consume |
| **SOLID violations** | **SRP:** bootstrap is god-module (F3 + F9–F14). **DIP:** platform imports `@/domains/*` directly |
| **Hidden coupling** | `getEventBus()` side-effects: starts 5-min schedulers for projections, parity, sync, health |
| **Scalability** | Sequential handler dispatch; no parallel consumer pools; wildcard `*` handlers on every event |
| **Risk** | **High** — composition root inversion; event storms on bulk import |
| **Recommended refactor** | Move `registerDefaultSubscribers` domain imports to `platformBootstrap`; implement subscriber tiers (sync observe / async project / shadow); publish `HandlerFailed` |
| **Backward compatibility** | Keep `getEventBus()` lazy singleton; extract bootstraps behind `bootstrapDomainEngines()` called from same entry point |

---

### 4. Facade Write Router

| Aspect | Assessment |
|--------|------------|
| **Current responsibilities** | 20 `facade*` functions; gate on `MIGRATION_DOMAIN_FACADES` + `!isInCommandBusContext()`; delegate to domain facades or write internals |
| **Should move elsewhere** | Routing table → declarative registry; domain imports → dynamic facade resolver |
| **Missing** | Coverage for non-command store writes; telemetry per route; explicit bypass audit log |
| **SOLID violations** | **OCP:** every new command requires new `facade*` function. **DIP:** imports 10 domain modules directly |
| **Hidden coupling** | Lives in `src/store/` but imports `src/domains/` — store layer depends on domain layer |
| **Scalability** | Manual function-per-operation does not scale to 100+ commands |
| **Risk** | **Medium** |
| **Recommended refactor** | Replace with `WriteRouter` registry: `{ operation, facadeMethod, commandType }[]`; code-gen from `commandTypes.ts` |
| **Backward compatibility** | Keep `facade*` as thin wrappers over registry during migration |

---

### 5. Write Internals

| Aspect | Assessment |
|--------|------------|
| **Current responsibilities** | Module-level registry of slice implementations; bypass facade re-entry for command handlers |
| **Should move elsewhere** | Slice logic itself → domain command handlers (long-term); registry → DI container |
| **Missing** | Lifecycle safety (unregister on hot reload); type safety beyond `unknown`; test doubles |
| **SOLID violations** | **SRP:** global mutable singleton. **ISP:** monolithic `WriteInternals` interface |
| **Hidden coupling** | Registered at store init; throws if called before store creation; ties command bus startup order to store |
| **Scalability** | Single process; no remote handler delegation |
| **Risk** | **Medium** |
| **Recommended refactor** | Interface segregation per aggregate; register via `kernel` bootstrap callback; add `isWriteInternalsReady()` guard with queue |
| **Backward compatibility** | Keep `getWriteInternals()`; add readiness check in `executeCommand` with clear error |

---

### 6. Projection Engine

| Aspect | Assessment |
|--------|------------|
| **Current responsibilities** | 16 projection handlers; per-event apply; checkpoint writes; global cursor; parity scheduler (5 min); `DEFAULT_TENANT_ID = "local"` |
| **Should move elsewhere** | Parity validation → report engine only; direct `@/lib/db` writes in handlers → projection storage abstraction |
| **Missing** | Account/Khata projection handlers; distributed lock; idempotent apply by `(projectionName, eventId)`; repair API wiring |
| **SOLID violations** | **SRP:** engine + scheduler + parity. Handlers mix projection storage and legacy DB |
| **Hidden coupling** | Resolves `globalSequence` from event store per event (async lookup in hot path); race with scheduler `rebuildFromCheckpoint` |
| **Scalability** | In-process lock only; no horizontal projection workers; sequential handler apply per event |
| **Risk** | **High** — projection race with 5-min scheduler; stale Zustand vs projection on reads |
| **Recommended refactor** | Per-projection idempotency key; wire `repairProjection`; separate live apply from scheduled rebuild; tenant-scoped cursors |
| **Backward compatibility** | Shadow mode unchanged; add handlers additively |

---

### 7. Sync Router (`syncEnqueueRouter`)

| Aspect | Assessment |
|--------|------------|
| **Current responsibilities** | Skip legacy outbox when `EVENT_SYNC && !DUAL_WRITE`; route through `syncDomain.enqueue` (command bus) when facades on |
| **Should move elsewhere** | Sync routing → sync platform module; not in `src/store/` |
| **Missing** | Explicit contract documenting event-store-as-source-of-truth; pull→Dexie apply; dual-write reconciliation |
| **SOLID violations** | **SRP:** store module owns sync policy |
| **Hidden coupling** | When `DUAL_WRITE=true`, sync enqueue goes command bus → legacy outbox **in addition to** event store — triple write path |
| **Scalability** | `EventSyncClient.pullRemote` advances cursor but does not apply to Dexie |
| **Risk** | **High** — multi-device divergence; silent data loss on pull |
| **Recommended refactor** | Move to `@/platform/sync/syncEnqueuePolicy.ts`; document single authoritative path; implement pull replay handler |
| **Backward compatibility** | `MIGRATION_DUAL_WRITE=true` restores legacy path unchanged |

---

### 8. Plugin Kernel

| Aspect | Assessment |
|--------|------------|
| **Current responsibilities** | Manifest load; extension point registration; capability registry; permission model; sandbox policy (stubs); activate on install |
| **Should move elsewhere** | Route registry → app router (not yet connected); sandbox enforcement → loader/bundler |
| **Missing** | Bundle isolation; `isForbiddenApi` at module load; route cutover (`MIGRATION_PLUGINS`); SDK consumer wiring |
| **SOLID violations** | **LSP:** sandbox claims isolation but provides none. **ISP:** 38 files, ~5 active at runtime |
| **Hidden coupling** | Bootstrapped from event-bus; shares JS heap with ERP; `pluginEvents.ts` imports `getEventBus` from bootstrap |
| **Scalability** | In-process only; no worker/iframe sandbox; no plugin versioning side-by-side |
| **Risk** | **Medium** — security theatre; dependency leaks via shared `node_modules` |
| **Recommended refactor** | Enforce `isForbiddenApi` in loader; lazy SDK instantiation; connect `MIGRATION_PLUGINS` to page registry only after parity |
| **Backward compatibility** | Builtin plugins remain in-repo; flags gate activation |

---

### 9. Platform Bootstrap

| Aspect | Assessment |
|--------|------------|
| **Current responsibilities** | Eager init of event/command/query buses; called from `main.tsx` and `initializeApp` |
| **Should move elsewhere** | Domain engine bootstraps should consolidate here instead of event-bus `registerDefaultSubscribers` |
| **Missing** | Ordered bootstrap phases; failure handling; health gate before UI render; shutdown hooks |
| **SOLID violations** | **SRP:** split between `platformBootstrap.ts` and `event-bus/bootstrap.ts` |
| **Hidden coupling** | `getEventBus()` triggers full F9–F14 bootstrap as side effect — hidden from `platformBootstrap.ts` readers |
| **Scalability** | Single-phase init; no lazy domain loading |
| **Risk** | **Medium** |
| **Recommended refactor** | Single `bootstrapRuntime(): BootstrapReport` with explicit phases: kernel → buses → projections → engines → plugins → sync |
| **Backward compatibility** | Keep `bootstrapPlatformRuntime()` as alias |

---

### 10. Domain Facades

| Aspect | Assessment |
|--------|------------|
| **Current responsibilities** | Thin wrappers: `executeCommand` / `executeQuerySync` per aggregate; fallback to `createLegacyStateReader` when query bus off |
| **Should move elsewhere** | Duplicate account APIs (`mastersDomain` vs `accountingDomain`) → single facade per bounded context |
| **Missing** | Used by UI directly (still go through store); validation; input DTOs; error mapping |
| **SOLID violations** | **DRY:** `mastersDomain.createAccount` ≡ `accountingDomain.createAccount`. **DIP:** facades import store types (`assertDateInFiscalYear`) |
| **Hidden coupling** | `createLegacyStateReader()` at module init — captures QUERY_FACADE flag at first import, not per call |
| **Scalability** | No async list pagination; no tenant scoping |
| **Risk** | **Medium** |
| **Recommended refactor** | Consolidate duplicate facades; facades become sole public API (store becomes private); add query context guard |
| **Backward compatibility** | Keep existing facade method names; deprecate duplicates with re-exports |

---

## Category Analysis (17 Dimensions)

### 1. Coupling — **High Risk**

| Coupling | Path |
|----------|------|
| Store → Domains | `facadeWriteRouter.ts` imports 10 domain modules |
| Platform → Store | `dispatch.ts` → `commandBusContext.ts` |
| Platform → Domains | `event-bus/bootstrap.ts` → F9–F14 |
| Legacy → Store | `legacyStoreAdapter` → `writeInternals`, `useStore` |
| Query → Query | `createLegacyStateReader` → `executeQuerySync` (recursion) |
| Domains → Platform | All facades → command/query bus (correct direction) |

### 2. Cyclic Dependencies — **Medium Risk**

- F15 broke `bootstrap ↔ ai-proposal` barrel cycle.
- Remaining: `store ↔ platform` (commandBusContext), `legacy ↔ store ↔ domains ↔ platform ↔ legacy`.
- Query recursion is logical cycle, not module cycle.

### 3. Hidden State — **High Risk**

| State | Location | Authority |
|-------|----------|-----------|
| Zustand arrays | `useStore` | UI hydration (de facto read SOT) |
| Dexie tables | Slices | Write SOT |
| Shadow engines | In-memory Maps | Observational only |
| Idempotency cache | In-memory Map | Lost on reload |
| Projection tables | Dexie v24 | Stale vs Zustand |
| Feature flags | Module + env | 40 flags, combinatorial |

### 4. Transaction Boundaries — **Medium Risk**

- Slices use Dexie `transaction()` correctly for voucher/invoice.
- Command bus has **no** outer transaction: command succeeds → event publish fails = inconsistent.
- `confirmKhataEntry` nested transactions (outer + `addVoucher` inner).
- Projection apply is **not** in same transaction as event store persist.

### 5. Event Consistency — **Medium Risk**

- Each accepted command publishes `CommandAccepted` + 1 domain event = **2 bus publishes**.
- Wildcard subscribers (`*`) invoked for every event — 4+ handlers per publish.
- `InvoicePosted` triggers: audit, notification (filtered), nios (filtered), sync (log), projection, inventory shadow, accounting shadow = **event fan-out ~7 handlers**.
- Not an event storm at single-user scale; becomes one at bulk import.

### 6. Command Consistency — **Low-Medium Risk**

- `commandBusContext` depth guard prevents facade recursion.
- Idempotency in-memory only — reload allows duplicate writes with new `commandId`.
- No optimistic concurrency (version fields on aggregates).

### 7. Query Consistency — **High Risk**

- Query handlers read Zustand via `createLegacyStateReader`.
- `MIGRATION_QUERY_FACADE=true` causes recursion in handlers.
- Report pages compute from `useStore` arrays, not query bus — **dual read authority**.
- Shadow compare runs fire-and-forget (`void runShadowCompare`) — no gating.

### 8. Plugin Isolation — **High Risk**

- `blockDirectStoreAccess()` and `blockDirectDexieAccess()` are empty stubs.
- Plugins in same bundle can `import { useStore }`.
- No Content Security Policy or iframe boundary.

### 9. Runtime Extensibility — **Medium Risk**

- Extension points registered at install but no consumer invokes them.
- `MIGRATION_PLUGINS` unused — 107 pages still on string routing.
- Command types closed set (24) — extending requires handler + facade + router + event map.

### 10. Testability — **High Risk**

- Zero unit tests for buses, projections, facades, routers.
- Global singletons (`getEventBus`, `getCommandBus`, `getWriteInternals`) prevent isolation.
- No test harness for bootstrap phases.

### 11. Performance — **Medium Risk**

- Synchronous command dispatch on main thread.
- Sequential event handler dispatch with retry.
- Full Zustand hydrate on login (`_loadAllData` — 50+ parallel Dexie reads).
- Shadow compare on every query (async, unawaited).

### 12. Failure Recovery — **Medium Risk**

- Event DLQ exists; projection repair API orphaned.
- Parity failures diagnostic-only (except F11 report cutover rollback).
- No automatic projection rebuild on handler error.
- `shutdown*` hooks exported but never called.

### 13. Observability — **Low-Medium Risk**

- Diagnostics modules per layer (command, event, query, projection, sync).
- No centralized trace by `correlationId` across buses.
- No metrics export / alerting.
- Shadow diff logged but not surfaced to operators.

### 14. Capability Evolution — **Medium Risk**

- Plugin capabilities registered but not consulted at runtime (except permission checks).
- NIOS core parallel to `src/nios/client` HTTP — dual AI runtime.
- Four AI stacks remain (per SYSTEM-05).

### 15. Multi-Company Isolation — **High Risk**

- `DEFAULT_TENANT_ID = "local"` in projection engine, event store, replay.
- `zustandContextProvider` uses `tenant:${companyId}` but projections ignore it.
- `selectedCompanyId` in store not propagated to buses.
- Multi-company = data corruption risk in projections and sync.

### 16. Offline-First Guarantees — **Low-Medium Risk**

- Dexie writes are offline-safe.
- Event store persists locally when `MIGRATION_EVENT_STORE=true`.
- Event sync push works; pull does not restore Dexie.
- Legacy `syncEngine` loop may still run if started elsewhere.

### 17. Future Distributed Execution — **High Risk**

Blockers for multi-node / multi-device:
- In-memory idempotency (not durable across tabs)
- Process-local projection lock
- No partition key on commands
- No saga compensation wired
- `SyncCommandBus` (not async queue)
- Tenant hardcoded
- No grpc/message envelope versioning

---

## Specific Anti-Pattern Findings

| Pattern | Location | Severity |
|---------|----------|----------|
| **Duplicate routing** | Store `facade*` + domain facade + command handler + write internals (4 hops) | Medium — intentional strangler |
| **Double dispatch** | `CommandAccepted` + domain event per command | Low — by design |
| **Command recursion** | Prevented by `commandBusContext` | ✅ Mitigated |
| **Query recursion** | `repositories.ts` QUERY_FACADE → handler → state reader → query bus | **Critical** |
| **Event storms** | 7+ handlers per invoice event; bulk import risk | Medium |
| **Projection race** | Live apply vs 5-min `rebuildFromCheckpoint` scheduler | High |
| **Transaction leaks** | Event publish after commit without outbox | High |
| **Shared mutable state** | Zustand + shadow engines + idempotency Map | High |
| **Feature flag complexity** | 40 flags; 10 previously unused; combinatorial testing | Medium |
| **Plugin dependency leaks** | Same JS bundle | High |
| **Cross-domain imports** | `facadeWriteRouter` → 10 domains; `event-bus/bootstrap` → 6 engines | High |
| **Improper abstraction** | `facadeWriteRouter` manual functions; sandbox stubs | Medium |
| **Sync bottlenecks** | `SyncCommandBus`, sequential event dispatch | Medium |
| **Distributed blockers** | tenant, idempotency, lock, pull apply | High |

---

## Top 20 Risks

| # | Risk | Layer | Level |
|---|------|-------|-------|
| R01 | Query recursion when `MIGRATION_QUERY_FACADE=true` | Query Bus | **Critical** |
| R02 | Dual read authority (Zustand hydrate vs Query Bus) | Query | **High** |
| R03 | `tenantId: "local"` hardcoded in projections/event store | Multi-tenant | **High** |
| R04 | Command accepted but event publish fails (no outbox) | Command/Event | **High** |
| R05 | Event sync pull does not apply to Dexie | Sync | **High** |
| R06 | ~80% store writes bypass command bus | Store | **High** |
| R07 | Platform bootstrap imports domain engines (layer inversion) | Event Bus | **High** |
| R08 | In-memory idempotency lost on reload | Command Bus | **High** |
| R09 | Projection scheduler races live apply | Projections | **High** |
| R10 | Plugin sandbox is non-enforcing | Plugin Kernel | **High** |
| R11 | `createLegacyStateReader` captured at module init | Query/Facades | **Medium** |
| R12 | Triple write when `MIGRATION_DUAL_WRITE=true` | Sync | **Medium** |
| R13 | Missing Account/Khata projection handlers | Projections | **Medium** |
| R14 | Shadow engines not gating (diagnostic only) | F9/F10 | **Medium** |
| R15 | No authorization on command/query dispatch | Identity | **Medium** |
| R16 | Event fan-out 7+ handlers per invoice | Event Bus | **Medium** |
| R17 | `facadeWriteRouter` OCP violation (manual per op) | Store | **Medium** |
| R18 | Zero platform unit tests | Testability | **Medium** |
| R19 | NIOS HTTP stack parallel to nios-core | AI Runtime | **Medium** |
| R20 | `HandlerFailed` never published | Event Bus | **Low** |

---

## Top 20 Improvements

| # | Improvement | Impact | Effort |
|---|-------------|--------|--------|
| I01 | Fix query recursion: handlers use `readLegacyState()` only | Critical | Quick |
| I02 | Persist command idempotency to Dexie | High | Quick |
| I03 | Propagate `tenantId` from identity to all buses | High | Medium |
| I04 | Transactional outbox for event publish | High | Medium |
| I05 | Implement sync pull → Dexie replay | High | Medium |
| I06 | Consolidate bootstrap into phased `bootstrapRuntime()` | High | Medium |
| I07 | Wire projection repair API | Medium | Quick |
| I08 | Add Account/Khata projection handlers | Medium | Medium |
| I09 | Per-projection idempotency `(name, eventId)` | Medium | Medium |
| I10 | Enforce authorization on dispatch | Medium | Medium |
| I11 | Replace `facadeWriteRouter` with declarative registry | Medium | Medium |
| I12 | Single read authority: deprecate direct `useStore` reads in reports | Medium | Large |
| I13 | Publish `HandlerFailed` from event dispatcher | Low | Quick |
| I14 | Plugin loader module boundary check | Medium | Medium |
| I15 | Wire `shutdown*` hooks on `beforeunload` | Low | Quick |
| I16 | Correlation ID trace across buses | Medium | Medium |
| I17 | Consolidate `mastersDomain` / `accountingDomain` | Low | Quick |
| I18 | Remove store import from `dispatch.ts` (kernel callback) | Medium | Medium |
| I19 | Parity-off returns `skipped` not `passed: true` | Medium | Quick |
| I20 | Golden CI gate (`MIGRATION_GOLDEN_CI`) | High | Large |

---

## Quick Wins (<1 Hour Each)

1. **Fix query recursion** — `createLegacyStateReader` QUERY_FACADE path must not be used by query handlers; use `readLegacyState()` in `legacyQueryHandlers.ts` and `legacyReadAdapters.ts` only.
2. **Persist idempotency** — Store `commandId → result` in Dexie `commandDedup` table (schema already additive).
3. **Publish `HandlerFailed`** — One line in `eventDispatcher.ts` catch block.
4. **Parity skipped status** — Change auto-pass when parity flag off to `{ passed: false, skipped: true }`.
5. **Consolidate duplicate facade** — `accountingDomain.createAccount` re-exports `mastersDomain.createAccount`.
6. **Wire `shutdownPluginKernel`** on `beforeunload` in `main.tsx`.
7. **Document sync authority** — Comment in `syncEnqueueRouter.ts` declaring event-store-as-SOT when `EVENT_SYNC && !DUAL_WRITE`.
8. **Add `isWriteInternalsReady()` guard** — Clear error if command dispatched before store init.
9. **Disable `MIGRATION_QUERY_FACADE`** until recursion fix verified — temporary safety valve.
10. **Export bootstrap phase log** — `bootstrapPlatformRuntime` returns which buses initialized.

---

## Medium Refactors (1–5 Days Each)

1. **Phased bootstrap composition root** — Move F9–F14 bootstraps from `event-bus/bootstrap.ts` to `platformBootstrap.ts` with ordered phases and failure report.
2. **Transactional outbox** — Persist events in same Dexie transaction as command side-effect; async publisher drains outbox.
3. **Tenant propagation** — Thread `tenantId` from `zustandContextProvider` through command envelope, event envelope, projection context.
4. **Sync pull replay** — Apply pulled envelopes to Dexie via command re-play or direct merge policy.
5. **Declarative write router** — Replace 20 `facade*` functions with registry driven by `commandTypes.ts`.
6. **Projection idempotency** — Skip apply if `(projectionName, eventId)` already processed.
7. **Authorization gate** — `getAuthorizationService().authorize(envelope)` in dispatch pipeline.
8. **Remove platform→store import** — Inject `runInCommandBusContext` via kernel bootstrap callback.
9. **Account/Khata projections** — Add handlers for missing event types.
10. **Correlation tracing** — Pass single `correlationId` from UI through command → event → projection → query shadow.

---

## Large Refactors (1–4 Weeks Each)

1. **Single read authority cutover** — Report pages consume `reportingDomain` / query bus only; remove `useStore` array reads for domain data.
2. **Command handler extraction** — Move slice logic from `writeInternals` into domain command handlers; store becomes projection cache only.
3. **Plugin bundle isolation** — Separate Vite entry per plugin; iframe or worker sandbox with message-passing SDK.
4. **Durable saga/compensation** — Wire F10 posting sagas as authoritative with rollback on failure.
5. **Golden CI + parity gates** — Block release on VG-01–VG-05; wire `MIGRATION_GOLDEN_CI`.
6. **Multi-company tenant isolation** — Partition Dexie by `companyId`; scoped event streams; per-tenant projection cursors.
7. **Async command queue** — Replace `SyncCommandBus` with queued dispatch for bulk operations.
8. **NIOS runtime unification** — Route `niosClient` through `nios-core` gateway; retire HTTP parallel stack.

---

## Items to NEVER Change

These are load-bearing invariants of the current runtime. Modifying them without a full migration plan will break production.

| Item | Reason |
|------|--------|
| `executeCommand()` / `executeQuery()` public API | All facades, plugins, AI pipeline depend on it |
| `CommandTypes` / `EventTypes` / `QueryTypes` string constants | Event store, projections, sync envelopes keyed by these |
| Dexie as offline write authority | Offline-first guarantee; no cloud-only cutover |
| `writeInternals` bypass for command handlers | Prevents facade recursion; removal causes infinite loop |
| `commandBusContext` depth guard | Load-bearing recursion prevention |
| `MIGRATION_DOMAIN_FACADES` rollback path | Production safety valve |
| `publishFromCommand` COMMAND_EVENT_MAP | Shadow engines, projections, sync all subscribe to these events |
| Legacy slice transaction logic in voucher/invoice | Accounting invariants (balance, period lock) enforced here |
| Feature flag registry pattern (`VITE_*` override) | Operational rollback for every phase |
| `legacyStoreAdapter` as handler delegate target | Command bus handler wiring depends on port interface |
| e-Khata proposal gate (`confirmKhataViaProposal`) | AI safety boundary per VG-10 |
| Additive Dexie schema only | AGENTS.md / SYSTEM-08 non-destructive migration rule |

---

## Recommended Runtime Roadmap

### Phase F16a — Stabilization (Weeks 1–2)
**Goal:** Architecture score 58 → 72

- Fix query recursion (I01)
- Persist idempotency (I02)
- Publish HandlerFailed (I13)
- Parity skipped semantics (I19)
- Wire projection repair (I07)
- Phased bootstrap (I06 partial)

### Phase F16b — Hardening (Weeks 3–6)
**Goal:** Architecture score 72 → 82

- Tenant propagation (I03)
- Transactional outbox (I04)
- Sync pull replay (I05)
- Authorization gate (I10)
- Account/Khata projections (I08)
- Correlation tracing (I20 partial)

### Phase F16c — Authority Shift (Weeks 7–12)
**Goal:** Architecture score 82 → 88

- Single read authority for reports (I12)
- Declarative write router (I11)
- Remaining store writes through bus (R06)
- Golden CI gate (I20)
- Parity gating on shadow engines

### Phase F17 — Intelligence Kernel (Weeks 13–20)
**Goal:** Architecture score 88 → 92

- NIOS runtime unification (large #8)
- Plugin bundle isolation (large #3)
- Multi-company tenant isolation (large #6)
- Async command queue (large #7)

### Phase F18 — Distributed Ready (Weeks 21+)
**Goal:** Architecture score 92 → 95

- Partition keys on commands/events
- Durable saga compensation
- Horizontal projection workers
- Multi-device conflict merge to Dexie

---

## Estimated Readiness After Improvements

| Milestone | Operational | Architecture | VG Gates |
|-----------|-------------|--------------|----------|
| **Today (F15)** | 72 | 58 | 2/11 partial |
| **F16a complete** | 78 | 72 | 4/11 |
| **F16b complete** | 85 | 82 | 7/11 |
| **F16c complete** | 90 | 88 | 9/11 |
| **F17 complete** | 93 | 92 | 10/11 |
| **F18 complete** | 95 | 95 | 11/11 |

---

## Assumptions Challenged

| Assumption | Reality |
|------------|---------|
| "Query facade routes reads through Query Bus" | Handlers recurse; reads still from Zustand |
| "Event sync replaces legacy sync" | Pull does not apply; dual-write path still exists |
| "Plugins are sandboxed" | Policy stubs only; same JS heap |
| "Projections are rebuildable" | Yes, but race with scheduler; repair unwired |
| "Single write path" | 20 ops via bus; ~100+ store ops still direct Dexie |
| "Shadow engines validate production" | Diagnostic only; parity-off auto-pass removed in F16a target |
| "Feature flags enable safe rollback" | 40 flags create untested combinations |
| "F15 connected the architecture" | Connected ≠ authoritative; Zustand still read SOT |

---

## Document Control

| Field | Value |
|-------|-------|
| Document | F16 |
| Version | 1.0 |
| Supersedes | — |
| References | SYSTEM-05–16, F15 cutover |
| Next action | F16a stabilization — fix R01 (query recursion) immediately |
