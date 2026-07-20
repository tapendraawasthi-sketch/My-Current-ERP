# PR-B1 blocking tickets (block PR-C until cleared)

## TICKET-PR-B1-001 — Staging operator attestation

- **Status:** PASS (2026-07-20 continuum operator chat attestation)
- **Blocks:** cleared for this ticket
- **Evidence:** `manual/OPERATOR_ATTESTATION.md`; `RUN_STATUS.json` `manual_run.status=PASS`
- **Clear when:** All manual critical rows PASS and `RUN_STATUS.json` `manual_run.status=PASS`. **Met.**

## TICKET-PR-B1-002 — Connected E2E green on staging URL

- **Status:** OPEN — Render attempt **FAIL** (2026-07-20 r3): 10 passed / 4 failed; sync NOT_RUN
- **Blocks:** PR-C / PR-C1-ARM
- **Required:** `ORBIX_E2E_CONNECTED=true` against staging erp_bot (Groq/provider configured) for:
  - `e2e/orbix-next12-launch-slice.spec.ts`
  - `e2e/orbix-connected.spec.ts`
  - `e2e/orbix-sales-connected.spec.ts`
  - `e2e/orbix-sync.spec.ts`
- **Progress (2026-07-20):** [my-current-erp.onrender.com](https://my-current-erp.onrender.com) SPA+bot alive; NEXT-12 3/3 green; purchase+sales **API** paths green after `ERP_BOT_BACKEND_URL` fix; browser Confirm/Dexie + `postE2ESale` + sync still red/missing. See `connected/CONNECTED_SUMMARY.md`.
- **Honesty:** Owner residual note was **not** accepted in this session (operator said they cannot act). Do not treat B1-002 as PASS.
- **Clear when:** `RUN_STATUS.json` `connected_run.status=PASS` with log path recorded, **or** explicit signed owner residual + OWNER_SIGNOFF.
