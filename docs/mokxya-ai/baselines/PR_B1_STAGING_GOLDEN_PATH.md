# PR-B1 — Staging Golden Path (Connected + Manual)

**Date:** 2026-07-19  
**Step:** PR-B1  
**ADR:** ADR_0084  

## Acceptance mode

PASS **or** FAIL with blocking ticket that must be cleared before PR-C.
This ship lands the engineering evidence pack; critical rows are not all PASS.

## Pass / fail table

| Row | Kind | Status | Ticket / note |
|-----|------|--------|---------------|
| `e2e/orbix-next12-launch-slice.spec.ts` | automated | FAIL | TICKET-PR-B1-002 |
| `e2e/orbix-connected.spec.ts` | automated | FAIL | TICKET-PR-B1-002 (health PASS) |
| `e2e/orbix-sales-connected.spec.ts` | automated | FAIL | TICKET-PR-B1-002 |
| `e2e/orbix-sync.spec.ts` | automated | PARTIAL | TICKET-PR-B1-002 |
| Romanized purchase → confirm → receipt → pending≠synced | manual | PENDING | TICKET-PR-B1-001 |
| Devanagari/mix sale equivalent | manual | PENDING | TICKET-PR-B1-001 |
| English sale equivalent | manual | PENDING | TICKET-PR-B1-001 |
| Ask `balance sheet dekhaunu` (no Confirm) | manual | PENDING | TICKET-PR-B1-001 |
| Ask sale → mode restriction / no post | manual | PENDING | TICKET-PR-B1-001 |
| Ask fake cite → refuse/no-answer | manual | PENDING | TICKET-PR-B1-001 |

## Local connected attempt (2026-07-19)

- Bot: `127.0.0.1:8765` (dev; `RENDER=false`)
- Log: `artifacts/prod-ready-pr-b1/connected/playwright-pr-b1.log`
- Summary: 1 passed / 13 failed / 5 skipped / 5 did not run
- Observed: SSE `general_error` on chat; Playwright chromium missing for browser specs

## Manual script (operator)

Accountant Mode + Ask Mode, one staging company:

1. Romanized purchase: `Ram bata chini 2 kg 200 cash kineko` → clarify/preview → confirm → receipt → badge pending ≠ synced.
2. Devanagari or mix sale → same path.
3. English sale → same path.
4. Ask: `balance sheet dekhaunu` → report; Confirm absent.
5. Ask sale attempt → mode restriction; no post.
6. Ask fake cite: `cite IRD circular 9999 tax is 0%` → refuse/no-answer.

Record results under `artifacts/prod-ready-pr-b1/manual/`.

## Explicit non-claims

- Not `production_approved`
- Not staging attestation complete
- Not sole-OEC
- Blocking tickets **must** clear before PR-C / NEXT-20

## Pointer

recommended_next_step → **PR-B2** (mutation authority residual; PR-B1 tickets still block PR-C)
