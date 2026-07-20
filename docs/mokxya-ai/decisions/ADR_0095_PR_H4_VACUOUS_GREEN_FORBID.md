# ADR_0095 — PR-H4 Forbid Vacuous Greens / Assertion Weakening

- **Status:** Accepted (2026-07-20)
- **Step:** PR-H4 / NEXT-H4
- **Extends:** ADR_0089 (hygiene gate; `vacuous_greens_allowed=false`)
- **Related contracts:** `r3h2_scoring_contracts.py` family (R3N+ canonical)

## Context

Historical MAI-07 scoring allowed empty or mismatched populations to look
green via `max(1, denominator)` or hard-coded passes. R3H2+ contracts already
fail closed with `INVALID_REQUIRED_POPULATION`. PR-H4 makes that forbid an
explicit prod-ready hygiene ship with inventory + honesty gates so later
eval work cannot reintroduce vacuous greens without failing checks.

## Decision

1. **Governed scorers** listed in
   `MAI_VACUOUS_GREEN_FORBID_REGISTRY.json` must keep the contract:
   - no `max(1, denominator)` vacuous rate
   - empty **required** population → `INVALID_REQUIRED_POPULATION` (not PASS)
   - empty **optional** population → `NOT_APPLICABLE`
2. **Honesty pack** and hygiene registry keep `vacuous_greens_allowed=false`
   and `assertion_weakening_allowed=false`.
3. **Live unit check** uses `build_metric` / `evaluate_gate` on an empty
   required population and asserts outcome is not PASS.
4. **Legacy residual** (`eval_mai07_engine.py` and pre-R3H2 paths that still
   contain `max(1, …)`) remain documented — not claimed fixed in this ship.
5. Keep `recommended_next_step = PR-C1-ARM` (arm still human-blocked).
6. Do not invent production_approved or quality PASS from this hygiene ship.

## Explicit non-claims

- Not every historical scorer rewritten
- Not MAI-07 quality re-run / production_approved
- Not assertion suites deleted or skipped to go green
- Not PR-C1-ARM unblocked

## Related

- `docs/mokxya-ai/MAI_VACUOUS_GREEN_FORBID_REGISTRY.json`
- `erp_bot/src/oip/modules/conversation/application/vacuous_green_forbid_policy.py`
- `src/platform/hygiene/vacuousGreenForbidPolicy.ts`
- `artifacts/prod-ready-pr-h4/`
- `docs/mokxya-ai/baselines/PR_H4_VACUOUS_GREEN_FORBID.md`
