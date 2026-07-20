# Connected run summary (PR-B1)

**Date:** 2026-07-20  
**Target:** Render staging — [https://my-current-erp.onrender.com](https://my-current-erp.onrender.com)  
**Bot:** `https://sutra-erp-bot.onrender.com` (also via SPA `/erp-bot` proxy)  
**Harness:** local Playwright webServer (`127.0.0.1:3000`) → same-origin `/erp-bot` proxy → Render bot  
**Command:** `ORBIX_E2E_CONNECTED=true ERP_BOT_BACKEND_URL=https://sutra-erp-bot.onrender.com npx playwright test`  
`e2e/orbix-next12-launch-slice.spec.ts` + `e2e/orbix-connected.spec.ts` + `e2e/orbix-sales-connected.spec.ts`  
(`orbix-sync.spec.ts` not run — requires isolated `ORBIX_SYNC_E2E` test-mode backend, not production)

## Probe

| Check | Result |
|-------|--------|
| SPA `/health` | ok (`sutra-erp`, commit `54da6420…` on Render at probe time) |
| `/erp-bot/ready` | ready; `posting_authority=dexie_local_first`; Groq configured |
| Direct bot `/health` | online; provider groq |
| Cold start | intermittent 502 on `/erp-bot/*` until bot wakes |

## Latest suite (r3, after sales `ERP_BOT_BACKEND_URL` fix)

| Metric | Count |
|--------|------:|
| Passed | 10 |
| Failed | 4 |
| Did not run | 5 |

### Passed (honest)

- Connected API readiness + Ask mode_restriction + purchase clarify/preview/mark-posted
- NEXT-12 launch slice (purchase / sales clarify / Ask report) — all 3
- Sales API Ask mode_restriction + incomplete sale clarification continuation

### Failed (still open)

- Browser Confirm UI → Dexie posting path (`orbix-clarification` not visible; blank/harness flake)
- Restricted-viewer / STATE A browser serial dependents (same clarification UI flake)
- Harness `postE2ESale` → `validation_error` (local Dexie seed/post path)
- Sync suite not executed (no production sync test-mode)

## Engineering fixes applied this session

1. `playwright.config.ts` — remote bot → browser uses same-origin `/erp-bot` (avoid CORS).
2. `e2e/orbix-sales-connected.spec.ts` — honor `ERP_BOT_BACKEND_URL` (was stuck on localhost via `ORBIX_BOT_URL` only).

## Ticket status

**TICKET-PR-B1-002 remains OPEN** — connected suite not fully green; sync not evidenced; do not claim PASS.

Local logs (gitignored): `playwright-pr-b1-render*.log`
