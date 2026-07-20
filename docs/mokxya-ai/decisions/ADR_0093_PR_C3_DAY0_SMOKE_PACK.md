# ADR_0093 — PR-C3 Day-0 Production Smoke Pack

- **Status:** Accepted (2026-07-20)
- **Step:** PR-C3-PACK
- **Outcome:** Smoke **pack READY**; execution **NOT_RUN**; not PASS

## Context

PR-C1 / PR-C2 release packages are READY with flags OFF. PR-C1-ARM remains
BLOCKED on human staging tickets and owner sign-off. Day-0 smoke (PR-C3)
cannot honestly PASS until at least one launch row is armed and a real
(or designated pilot) company is available.

## Decision

1. File Day-0 smoke checklist + report template under
   `docs/mokxya-ai/releases/DAY0_PRODUCTION_SMOKE_V1.md`.
2. Record pack readiness in `artifacts/prod-ready-pr-c3/` with
   `smoke_status=NOT_RUN` and `smoke_pass=false`.
3. Wire honesty policy that forbids claiming smoke PASS / production
   Day-0 green without evidence.
4. Keep `recommended_next_step = PR-C1-ARM`.
5. Mark progress `PR-C3 | PACK_READY` (not DONE). Smoke PASS remains a
   later **PR-C3-RUN** after arm.

## Also recorded this ship

PR-H1 / PR-H2 were already covered by PR-B6 (ADR_0089). Progress table
updates them to DONE → evidence ADR_0089 / PR_B6_HYGIENE_GATE.md.
PR-H3 / PR-H4 hygiene ships landed; Day-0 smoke still NOT_RUN until after arm.

## Explicit non-claims

- Not Day-0 smoke PASS
- Not production_approved
- Not NEXT-20 DONE
- Not flags armed

## Related

- ADR_0090 / ADR_0091 / ADR_0092
- `artifacts/prod-ready-pr-c3/SMOKE_CHECKLIST.md`
