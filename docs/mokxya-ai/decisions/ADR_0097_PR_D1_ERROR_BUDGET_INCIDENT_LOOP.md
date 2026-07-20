# ADR_0097 — PR-D1 Error Budget & Incident Loop Pack

- **Status:** Accepted (2026-07-20)
- **Step:** PR-D1
- **Outcome:** Incident-loop pack **READY**; not 14-day stable

## Context

PR-C1-ARM remains BLOCKED on human staging tickets. PR-D4 filed the
operator runbook. PR-D1 requires a weekly monitoring / incident loop so
P0/P1 launch defects become hotfixes with tests — without claiming
production stability yet.

## Decision

1. File error-budget + incident loop at
   `docs/mokxya-ai/releases/ERROR_BUDGET_INCIDENT_LOOP_V1.md`.
2. Define launch signals, severity, weekly review cadence, hotfix rules.
3. Mark `PR-D1 | PACK_READY` — does **not** claim 14 consecutive clean days.
4. Keep `recommended_next_step = PR-C1-ARM`.
5. Forbidden: inventing incident-free production or production_approved.

## Explicit non-claims

- Not production_approved
- Not 14-day stable
- Not PR-D2/D3 DONE
- Not Day-0 smoke PASS

## Related

- ADR_0096 operator runbook
- ADR_0090 / ADR_0092 monitoring sections
- `artifacts/prod-ready-pr-d1/`
