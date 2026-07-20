# Connected run summary (PR-B1)

**Date:** 2026-07-20  
**Staging UI:** https://my-current-erp.onrender.com  
**Bot:** https://sutra-erp-bot.onrender.com  

## r6 — launch connected pack (PASS)

**Command:**  
`PLAYWRIGHT_BROWSERS_PATH=… ORBIX_E2E_CONNECTED=true ERP_BOT_BACKEND_URL=https://sutra-erp-bot.onrender.com npx playwright test`  
`e2e/orbix-next12-launch-slice.spec.ts` + `e2e/orbix-connected.spec.ts` + `e2e/orbix-sales-connected.spec.ts`

| Metric | Count |
|--------|------:|
| Passed | **19** |
| Failed | **0** |

Log: `playwright-pr-b1-render-r6.log` (local/gitignored)

## r4 — sync pack (PASS)

**Command:** local `:3010` `ORBIX_SYNC_TEST_MODE` + `ORBIX_SYNC_E2E=true` → `e2e/orbix-sync.spec.ts`

| Metric | Count |
|--------|------:|
| Passed | **5** |
| Failed | **0** |

Includes Device A→B purchase and sales push/pull, readiness, duplicate/integrity, lost-ack replay.

Log: `playwright-pr-b1-sync-r4.log` (local/gitignored)

## Engineering fixes (sync go)

1. Root cause of `pushSyncPending=0`: post fires `runEventSyncCycle()` which holds the sync Web Lock; bare `pushPending` used `ifAvailable` and returned 0 while the auto-cycle was syncing.
2. `EventSyncClient.pushPending` retries briefly when the lock is busy.
3. `e2e/orbix-sync.spec.ts` drains via `flushSyncQueue` (same pattern as return/settlement sync specs) and asserts final `synced` / `remaining=0`.

## Ticket

**TICKET-PR-B1-002:** **PASS** — launch connected 19/19 + sync 5/5.  
PR-C1-ARM still blocked on B3-001, B5-001, and real OWNER_SIGNOFF (not invented).
