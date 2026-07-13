# Orbix Phase 5 — Synchronization Report

> **PHASE 5 FINAL GATE PASSED — READY FOR SALES CONVERGENCE**
> Gate executed 2026-07-12 (connected + two-device suites re-run).

## Phase 5 final gate results

| Gate | Result |
|------|--------|
| Backend `ORBIX_SYNC_TEST_MODE` on `:3010` | PASS — file_store, test_mode=true |
| `/api/health` + `/api/sync/ready` | PASS |
| Connected Orbix Playwright | **13/13 PASS** (includes STATE A + STATE B) |
| STATE A clarification refresh | PASS — same draft_id after reload; continuation works |
| STATE B preview refresh | PASS — confirm once; one invoice/voucher/stock |
| Device A post → push | PASS |
| Device B pull → apply | PASS |
| Device B Day Book / Purchase / Stock screenshots | PASS (`artifacts/orbix-sync/`) |
| No outbound loop on Device B | PASS |
| Duplicate push + integrity mismatch | PASS |
| Lost-ack recovery via duplicate replay | PASS |
| Vite build (prior session) | PASS |
| Orbix unit 33/33 (prior) | PASS |

### Backend start command used

```powershell
cd packages/backend
$env:ORBIX_SYNC_TEST_MODE="true"
$env:ORBIX_SYNC_USE_FILE_STORE="true"
$env:ORBIX_SYNC_STORE_PATH="...\My-Current-ERP\.data-test-sync"
$env:PORT="3010"
npx tsx src/server.ts
```

### Connected suite command

```powershell
$env:ORBIX_E2E_CONNECTED="true"
$env:ERP_BOT_BACKEND_URL="http://127.0.0.1:8765"
$env:VITE_ERP_BOT_URL="http://127.0.0.1:8765"
$env:VITE_SELF_CONTAINED_AI="false"
$env:E2E_PORT="3001"
npx playwright test e2e/orbix-connected.spec.ts
```

### Two-device sync command

```powershell
$env:ORBIX_SYNC_E2E="true"
$env:ORBIX_SYNC_BACKEND_URL="http://127.0.0.1:3010"
$env:VITE_ORBIX_SYNC_TEST_MODE="true"
$env:VITE_API_URL="http://127.0.0.1:3010"
$env:E2E_PORT="3001"
npx playwright test e2e/orbix-sync.spec.ts
```

## Gate fixes applied during this run

1. Restored `activeDraftId` / pending confirm from persisted `orbixResponse` after reload (STATE A).
2. Do not restore pending confirm after `posting_completed` (refresh-after-post).
3. Sync test-mode company scoping allows E2E company body override.
4. Harness `postE2EPurchase` + sync helpers for two-device E2E.
5. HMR-safe `getLedgerSnapshot` retries.

## Remaining limitations (honest)

- Production JWT must carry validated `companyId` (test mode is separate).
- Snapshot / full restore still deferred.
- Legacy entity `syncOutbox` still runs beside event sync for masters/entities.
- Device registration schema/interface incomplete for production.

## Next phase

**PHASE 6 — Authoritative Sales command convergence** may now begin.


## 1. Sync systems found

| System | Path | Class |
|--------|------|-------|
| Legacy entity outbox | `syncOutbox` → `src/lib/syncEngine.ts` → `/api/sync/push\|pull` | **A** entity (non-accounting authority) |
| Event-carried sync | `src/platform/sync/*` → `eventSyncQueue` → `/api/sync/events/push\|pull` | **I** canonical accounting sync |
| Domain event store | `domainEvents` | **G** local append log |
| `enqueueAfterDomainWrite` | dual-write gated off | **E** |
| Purchase atomic outbox | `postPurchaseTransaction` | writes both legacy `syncOutbox` + event queue |

## 2. Canonical path selected

**LOCAL Dexie authority → durable `eventSyncQueue` → authenticated `/api/sync/events/*` → remote `sync_events` → pull/apply without outbound loop.**

## 3. Legacy paths

- `syncEngine` kept for entity sync; SyncStatusControl now aggregates event queue + legacy.
- Accounting sync status prefers `eventSyncQueue`.
- Not deleted.

## 4. Local event schema

`AccountingSyncEvent` in `src/platform/sync/accountingSyncContract.ts` (schema_version `1.0`), mapped to existing `SyncEventEnvelope` for transport.

## 5. Device identity

`fios_sync_device_id` in localStorage via `getOrCreateDeviceId()` (`vectorClock.ts`). Persistent UUID per browser profile; not an auth credential.

## 6. Local sequencing

Dexie `syncLocalSequences` (v28) — company/tenant scoped monotonic `localSequence` + hash-chain tip.

## 7. Payload hashing

SHA-256 over canonical `stableStringify` of purchase payload (`payloadHash.ts`).

## 8. Hash-chain decision

**Enabled:** `event_hash = hash(previous_event_hash + payload_hash + metadata)`. Tamper-evident within device/company stream. Not non-repudiation (no hardware/server signatures yet).

## 9. Company sync policy

`companySettings.syncPolicy`: `local_only` | `sync_enabled` | `sync_required` (default `sync_enabled`). Explicit; not inferred from URL.

## 10. Atomic outbox verification

`enqueuePurchaseSyncInTransaction` runs inside the purchase Dexie txn (with `Dexie.waitFor` around crypto). Unit test asserts `eventSyncQueue` + `domainEvents` row on success. Hash failure / schema missing aborts posting when sync required.

## 11. Remote endpoint

- `POST /api/sync/events/push`
- `GET /api/sync/events/pull?since=&companyId=`
- `POST /api/sync/events/e2e-reset` (test mode only)

## 12–13. Remote schema / migrations

`packages/backend/src/db/migrations/20260712_phase5_sync_events.sql` + runtime `ensureEventSyncTables()`. File store used when `ORBIX_SYNC_TEST_MODE` / no `DATABASE_URL`.

Target: **immutable event log + acknowledgement + conflict records** (normalized accounting projection incremental via client apply).

## 14. Remote authentication

JWT Bearer (production). Test mode: `Bearer orbix-sync-e2e-token` when `ORBIX_SYNC_TEST_MODE=true`.
**Gap:** tokens without `companyId` claim require test mode or reject; production must embed company on token.

## 15–17. Push idempotency / duplicate / integrity

- Unique `(tenant, company, event_id)` and `(tenant, company, idempotency_key)`
- Identical replay → `duplicate` + ack
- Modified payload same event/idempotency → `conflict` / `integrity_hash_mismatch`

## 18–22. Worker / claim / retry / backoff / dead-letter

- Web Locks (`syncWorkerLock.ts`) + Dexie lease (`claimExpiresAt`)
- Exponential backoff + jitter (`syncRetry.ts`)
- Permanent → dead letter (`eventSyncDeadLetter`)
- Conflict status distinct from failed

## 23–26. Pull / cursor / apply / loop prevention

- Cursor in `eventSyncCursors` / advance only after successful apply
- `applyRemoteSyncEnvelope` applies facts; marks `origin: remote_sync`; **does not** enqueue outbound `purchase_posted`
- Same-device pull treated as acknowledgement

## 27–30. Versions / voucher collision / conflicts / masters

- Aggregate version starts at 1; collisions → `invoice_number_collision` conflict (no silent overwrite / no LWW)
- Missing item master → `deleted_or_missing_master` conflict
- Conflict store: `eventSyncConflicts`

## 31–33. Balance / stock / Sync UI

- Sync **facts** (movements, invoices, vouchers); balances derived; reconciliation detects mismatch
- SyncStatusControl: Synced / Syncing / Pending / Offline / Sync failed / Conflict / Action required / Local-only
- Orbix result: **Posted locally** + Waiting to sync / Synced / Offline / Failed / Conflict

## 34–44. Recovery / two-device / reconciliation / restore / snapshot

- Restart recovery: pending + expired lease reclaim
- Lost ack: duplicate push returns duplicate → mark synced
- Two-device Playwright: `e2e/orbix-sync.spec.ts` (gated `ORBIX_SYNC_E2E`)
- Reconciliation: `runLocalReconciliation` read-only
- Restore/snapshot: **documented deferred** — event-only restore path defined; snapshots recommended when event count grows large

## 45–48. Phase 4 refresh tests / security / test safety

- STATE A/B added to `e2e/orbix-connected.spec.ts` (run with `ORBIX_E2E_CONNECTED=true`)
- Browser-local authority remains; remote hash detects tamper, does not prevent it
- E2E reset refuses non-E2E company IDs

## Test results (this session)

| Suite | Result |
|-------|--------|
| Orbix unit (`src/__tests__/orbix`) | **33/33 pass** |
| Backend file-store ingest | **OK** |
| Vite build | **pass** |
| Connected Orbix Playwright 11/11 | not re-run this session — run before release |
| Two-device Playwright | gated; requires backend + `ORBIX_SYNC_E2E=true` |
| Clarification/preview refresh STATE A/B | added; run with connected suite |

## Files created / changed (key)

**Created:** `accountingSyncContract.ts`, `payloadHash.ts`, `companySyncPolicy.ts`, `localSequence.ts`, `enqueuePurchaseSync.ts`, `applyRemoteEvent.ts`, `reconciliation.ts`, `syncStatusAggregate.ts`, `syncWorkerLock.ts`, `eventSyncStore.ts`, `syncEvents.ts`, migration SQL, `docs/ORBIX_PHASE5_SYNC.md`, tests, `e2e/orbix-sync.spec.ts`

**Changed:** `postPurchaseTransaction.ts`, `syncQueue.ts`, `syncClient.ts`, `syncTransport.ts`, `syncRetry.ts`, `syncServerContracts.ts`, `db.ts` (v28), `SyncStatusControl.tsx`, `OrbixResponseRenderer.tsx`, `sync.ts` routes, `orbix-connected.spec.ts`

## Known limitations

1. Browser cannot guarantee background sync when tab closed.
2. Multi-device voucher numbers can collide → conflict, not silent renumber.
3. Remote JWT company scoping gap if token lacks `companyId`.
4. Account balances not treated as remote truth; rebuild/reconcile.
5. Full production restore + snapshots deferred.
6. Two active schedulers (legacy + event) still coexist — event path is accounting authority.

## Recommended next phase

**Phase 6 — Sales command convergence + cut over legacy entity sync for accounting entities**, then production device registration, signed snapshots, and server-side posting gates only if product requires server-grade authority.
