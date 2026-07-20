# PR-B3 blocking tickets

## TICKET-PR-B3-001 — Staging conflict → reconfirm exercise

- **Status:** OPEN — engineering collision E2E **PASS**; operator reconfirm step still **PENDING**
- **Blocks:** PR-C1-ARM completeness
- **Does not block:** PR-B4…PR-B6 residual engineering
- **Evidence (engineering):** `e2e/orbix-launch-conflict.spec.ts` + `artifacts/prod-ready-pr-b3/e2e/`
- **Clear when:** Operator completes remaining reconfirm checklist in `CONFLICT_RECONFIRM_NARRATIVE.md` and `RUN_STATUS.json` `staging_conflict_attested=true`

## Related (from PR-B1)

- TICKET-PR-B1-001 — **PASS**
- TICKET-PR-B1-002 — **PASS** (sync 5/5)

**Note:** False PASS from commit `2e0b45aa` (chat `approved b3`) is **VOID**.
