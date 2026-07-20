# ADR_0096 — PR-D4 Operator Runbook Pack

- **Status:** Accepted (2026-07-20)
- **Step:** PR-D4
- **Outcome:** On-call runbook **PACK READY**; not post-launch stable

## Context

PR-C1/C2 packages are READY with flags OFF. PR-C1-ARM remains BLOCKED on
human staging tickets. PR-H hygiene is complete. Operators still need a
single runbook for confirm failures, sync stuck, Ask abstain spikes, and
rollback — before and after arm.

## Decision

1. File operator runbook at
   `docs/mokxya-ai/releases/OPERATOR_RUNBOOK_LAUNCH_V1.md`.
2. Cover: confirm token denials, posting failures, sync pending age,
   Ask abstain spikes, mode restrictions, rollback for both launch rows.
3. Mark progress `PR-D4 | PACK_READY` — does **not** claim 14-day stability
   or close PR-D1…D3.
4. Keep `recommended_next_step = PR-C1-ARM`.
5. Forbidden: inventing production_approved or incident-free claims.

## Explicit non-claims

- Not production_approved
- Not 14-day stable production
- Not PR-D1/D2/D3 DONE
- Not Day-0 smoke PASS

## Related

- ADR_0090 / ADR_0092 release dossiers
- ADR_0093 Day-0 smoke pack
- `artifacts/prod-ready-pr-d4/`
