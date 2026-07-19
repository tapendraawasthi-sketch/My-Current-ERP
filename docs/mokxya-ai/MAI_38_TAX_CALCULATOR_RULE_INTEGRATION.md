# MAI-38 — Tax Calculator / Rule Integration

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING` (not production-approved)  
**Authority:** [ADR_0055](decisions/ADR_0055_TAX_CALCULATOR_RULE_INTEGRATION_AUTHORITY.md)  
**Runtime:** `mai-38.0.2-slice2` (engineering; not production-approved)  
**Closure:** [MAI_38_ENGINEERING_CLOSURE.md](baselines/MAI_38_ENGINEERING_CLOSURE.md)

## Objective

Declare tax-calculator / rule-integration policy bound to the MAI-37 IT/VAT/TDS
pilot — without loading rule tables, computing amounts, posting, or claiming
production calculator authority.

## Slice 1

1. Ingress `TAX_CALCULATOR_RULE_INTEGRATION_*` after CORE_NEPAL_TAX_KNOWLEDGE_PILOT
2. Semantic input: MAI-37 pilot COMPLETE + readiness ∈ `{POLICY_DECLARED, SCOPE_PARTIAL}`
3. `rule_integration_status=POLICY_ONLY`
4. `calculation_executed=false`; `amount_computed=false`; `rate_applied=false`
5. `rule_table_loaded=false`; `calculator_production_eligible=false`
6. Calc-intent cues documented only (`CALC_INTENT_DETECTED_NOT_EXECUTED`)
7. Dates unproven; GAP-P2-008 OPEN

## Slice 2

1. `resolve_calculator_consume_mode` / `build_calculator_rule_candidate`
2. Default `CANDIDATE_ONLY` — rule refs / computed amount / definitive null
3. Fake calculation claim → `BLOCKED`; non-pilot → `SKIP`
4. Live path forces `allow_rule_table_load=false` / `allow_live_calculation=false`
5. Metadata: `calculator_consume_ready` + `calculator_rule_candidate`

## Gates

| Case | Expect |
|------|--------|
| VAT / TDS pilot | COMPLETE → `CANDIDATE_ONLY` |
| Calc-intent text | still no execution |
| Fake calculation claim | `BLOCKED` |
| purchase / no pilot | SKIP |
| Any live path | never calculate; GAP-P2-008 OPEN |

## Non-goals

- Live tax calculation
- Closing GAP-P2-008
- Production calculator eligibility
- Production approval
