# PR-B1 blocking tickets (block PR-C until cleared)

## TICKET-PR-B1-001 — Staging operator attestation

- **Status:** PASS (2026-07-20 continuum operator chat attestation)
- **Blocks:** cleared for this ticket
- **Evidence:** `manual/OPERATOR_ATTESTATION.md`; `RUN_STATUS.json` `manual_run.status=PASS`

## TICKET-PR-B1-002 — Connected E2E green on staging URL

- **Status:** OPEN — launch connected **PASS 19/19** (2026-07-20 r6); sync **FAIL 2** (device push/pull)
- **Blocks:** PR-C / PR-C1-ARM
- **Evidence:** `connected/CONNECTED_SUMMARY.md`
- **Clear when:** full pack including sync green, **or** explicit signed owner residual + OWNER_SIGNOFF.
