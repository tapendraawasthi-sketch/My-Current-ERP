# PR-B3 blocking tickets

## TICKET-PR-B3-001 — Staging conflict → reconfirm exercise

- **Status:** OPEN
- **Blocks:** PR-C staging hard-proof completeness (with PR-B1 tickets)
- **Does not block:** PR-B4…PR-B6 residual engineering
- **Clear when:** Operator completes checklist in `CONFLICT_RECONFIRM_NARRATIVE.md` and `RUN_STATUS.json` `staging_conflict_attested=true`

## Related open (from PR-B1)

- TICKET-PR-B1-001 manual staging attestation — **PASS**
- TICKET-PR-B1-002 connected E2E green on staging — **OPEN** (sync 2 FAIL)

**Note:** False PASS from commit `2e0b45aa` (chat `approved b3`) is **reversed**.
