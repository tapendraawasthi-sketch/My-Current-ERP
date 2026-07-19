# PR-B1 blocking tickets (block PR-C until cleared)

## TICKET-PR-B1-001 — Staging operator attestation

- **Status:** OPEN
- **Blocks:** PR-C / NEXT-20 `production_approved`
- **Does not block:** PR-B2…PR-B6 residual engineering
- **Required:** Human runs manual script in `PR_B1_STAGING_GOLDEN_PATH.md` against staging (or local prod-like) company; attach results under `artifacts/prod-ready-pr-b1/manual/`.
- **Clear when:** All manual critical rows PASS and `RUN_STATUS.json` `manual_run.status=PASS`.

## TICKET-PR-B1-002 — Connected E2E green on staging URL

- **Status:** OPEN — local attempt **FAIL** (2026-07-19): 1 passed / 13 failed; log `connected/playwright-pr-b1.log`
- **Blocks:** PR-C
- **Required:** `ORBIX_E2E_CONNECTED=true` against staging erp_bot (Groq/provider configured) for:
  - `e2e/orbix-next12-launch-slice.spec.ts`
  - `e2e/orbix-connected.spec.ts`
  - `e2e/orbix-sales-connected.spec.ts`
  - `e2e/orbix-sync.spec.ts`
- **Also required:** `npx playwright install` (or CI browser cache) for browser specs
- **Clear when:** `RUN_STATUS.json` `connected_run.status=PASS` with log path recorded.
