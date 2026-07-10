# Wave 1 Dexie Migration — Stage 1 (v26)

**Issue:** FI-021  
**Date:** 2026-07-10  
**Status:** Implemented

## Summary

Dexie schema **version 26** adds the authoritative `periodLocks` table used by posting enforcement and the Period Lock UI. Legacy period locks stored in browser `localStorage` (`sutra_period_locks`) are imported automatically on upgrade.

## Version chain

| Version | Wave | Change |
|---------|------|--------|
| 25 | F8 | Event sync pipeline tables |
| **26** | **W1 Stage 1** | **`periodLocks` table + legacy import** |

## Table definition

```
periodLocks: "id, companyId, periodKey, fiscalYear, lockedAt, isUnlocked"
```

### Row shape (`DBPeriodLock`)

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | Primary key |
| `periodKey` | yes | Canonical `${year}-${month}` (month not zero-padded), e.g. `2025-7` |
| `lockedAt` | yes | ISO timestamp |
| `companyId` | no | Company scope for year-end locks |
| `fiscalYear` | no | Fiscal year id when created from year-end close |
| `isUnlocked` | no | `true` = inactive; row may remain for audit or be deleted by UI |
| `lockedBy`, `lockedByName`, `lockReason` | no | Audit metadata |

## Upgrade behavior (v25 → v26)

1. Dexie creates `periodLocks` store.
2. Upgrade hook calls `importLegacyPeriodLocksIntoDexie()`:
   - Reads `localStorage.sutra_period_locks`
   - Imports active locks (`isUnlocked !== true`)
   - Dedupes by normalized `periodKey`
   - Clears localStorage after successful import
3. `notePeriodLockDbUpgrade()` invalidates in-memory lock cache.

**Additive only** — no data loss; rollback = disable `W1_PERIOD_LOCK_ENFORCE` (locks remain in DB).

## Manual migration

**UI:** Period Lock page → “Import legacy locks” banner (when localStorage data remains).

**Code:**

```typescript
import { getDB } from "@/lib/db";
import { importLegacyPeriodLocksIntoDexie } from "@/lib/periodLock";
import { invalidatePeriodLockCache } from "@/lib/ledger/periodLockService";

const db = getDB();
await importLegacyPeriodLocksIntoDexie(db, { clearLocalStorageAfterImport: true });
invalidatePeriodLockCache();
```

## Feature flags

| Flag | Default | Rollback |
|------|---------|----------|
| `W1_PERIOD_LOCK_ENFORCE` | `true` | Set `VITE_W1_PERIOD_LOCK_ENFORCE=false` — posting checks skipped |
| `W1_FAIL_CLOSED_INIT` | `true` | Set `VITE_W1_FAIL_CLOSED_INIT=false` — init errors fall back to legacy `no-company` + `isDbReady: true` |

## Verification

```bash
npx tsc --noEmit
npm run test:accounting
rg "version(26)" src/lib/db.ts
rg "periodLocks" src/lib/db.ts
```

## PostgreSQL

No PG migration in Stage 1. Future sync (Wave 6) may mirror `periodLocks` to a tenant-scoped PG table for multi-device enforcement.
