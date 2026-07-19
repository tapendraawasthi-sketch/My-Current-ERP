# MAI-38 — Tax Calculator / Rule Integration

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0055](decisions/ADR_0055_TAX_CALCULATOR_RULE_INTEGRATION_AUTHORITY.md)  
**Runtime:** `mai-38.0.1-slice1` (engineering; not production-approved)

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

## Gates

| Case | Expect |
|------|--------|
| VAT / TDS pilot | COMPLETE → `POLICY_DECLARED` (or `RULE_TABLE_PENDING` if SCOPE_PARTIAL) |
| Calc-intent text | still no execution |
| purchase / no pilot | SKIP |
| Any live path | never calculate; GAP-P2-008 OPEN |

## Non-goals

- Live tax calculation (slice 2+ may candidate only)
- Closing GAP-P2-008
- Production calculator eligibility
- Production approval
