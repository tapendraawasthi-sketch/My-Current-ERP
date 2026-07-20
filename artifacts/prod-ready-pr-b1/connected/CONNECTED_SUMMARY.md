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

## Sync pack (PARTIAL)

**Command:** local `:3010` `ORBIX_SYNC_TEST_MODE` + `ORBIX_SYNC_E2E=true` → `e2e/orbix-sync.spec.ts`

| Metric | Count |
|--------|------:|
| Passed | 3 |
| Failed | 2 |

Failed: Device A→B purchase push/pull; Device A→B sales push/pull (`pushSyncPending` returned 0 — envelope/claim path).  
Passed: readiness, duplicate/integrity, lost-ack replay.

Log: `playwright-pr-b1-sync-r2.log` (local/gitignored)

## Engineering fixes (this go)

1. E2E fiscal year rolled to **2026-07-16 → 2027-07-15** (was ending 2026-07-15 → `period_or_fy` / sale `validation_error`).
2. UI QA harness wrapped in **MemoryRouter** (Billing used `useAppRoute` → blank page).
3. Confirm E2E asserts **eventSyncQueue** (Phase 6 cutover; not legacy `syncOutbox`).
4. Day Book / billing locators updated for ReportWorkspace titles.

## Ticket

**TICKET-PR-B1-002:** still **OPEN** — launch connected green, but sync two-device push/pull not green. Do not invent PASS.
