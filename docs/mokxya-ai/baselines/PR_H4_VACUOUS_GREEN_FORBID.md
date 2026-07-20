# PR-H4 — Vacuous Green Forbid

**Date:** 2026-07-20  
**Step:** PR-H4 / NEXT-H4  
**ADR:** ADR_0095  
**Extends:** ADR_0089

## Gate

| Check | Evidence |
|-------|----------|
| Empty required pop ≠ PASS | `empty_required_population_outcome()` → `INVALID_REQUIRED_POPULATION` |
| `metric_value(0,0)` | `None` (no vacuous 1.0) |
| Contract markers | R3H2/R3N* modules contain `No max(1, denominator)` + `INVALID_REQUIRED_POPULATION` |
| Honesty flags | `vacuous_greens_allowed=false`; `assertion_weakening_allowed=false` |

## Commands

```text
cd erp_bot && set PYTHONPATH=src && python -m pytest tests/oip/language_runtime/test_mai_pr_h4_vacuous_green_forbid.py -q
npx vitest run src/__tests__/orbix/maiPrH4VacuousGreenForbid.test.ts
```

## Residual

Pre-R3H2 `eval_mai07_engine.py` may still contain `max(1, …)` — inventoried, not claimed fixed.

## Pointer

`recommended_next_step` → **PR-C1-ARM** (still human-blocked).
