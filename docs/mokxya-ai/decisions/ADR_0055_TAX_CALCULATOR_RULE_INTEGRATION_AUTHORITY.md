# ADR_0055 — Tax Calculator / Rule Integration Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-38-TAX-CALCULATOR-RULE-INTEGRATION (slice 1)
- **Extends:** ADR_0001, ADR_0054, ADR_0047

## Context

MAI-37 declares a narrow IT/VAT/TDS knowledge pilot and emits tax-pilot
candidates without calculating. MAI-38 must declare calculator/rule integration
policy before any live computation. GAP-P2-008 and unproven effective dates
remain open.

## Decision

1. MAI-38 owns `TaxCalculatorRuleIntegrationBundleV1` on
   `CanonicalAIRequestV1` after CORE_NEPAL_TAX_KNOWLEDGE_PILOT.
2. Semantic gate: MAI-37 pilot COMPLETE + readiness in
   `{POLICY_DECLARED, SCOPE_PARTIAL}`; upstream BLOCKED → calculator BLOCKED.
3. Slice 1: declare `rule_integration_status=POLICY_ONLY`,
   `calculation_executed=false`, `amount_computed=false`,
   `rate_applied=false`, `rule_table_loaded=false`,
   `calculator_production_eligible=false`,
   `tax_calculator_invoked=false`,
   `legal_effective_dates_proven=false`,
   `gap_p2_008_status=OPEN`.
4. Calc-intent text may set `calc_intent_detected=true` with reason
   `CALC_INTENT_DETECTED_NOT_EXECUTED` — never executes.
5. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Live calculation in slice 1 | Authority / honesty risk |
| Load rate/rule tables as authority | Dates unproven; GAP-P2-008 open |
| Mark production eligible | Specialist / honesty review required |
| Close GAP-P2-008 | Honesty review still required |
| Prove effective dates | Must stay false |

## Related

- `docs/mokxya-ai/MAI_38_TAX_CALCULATOR_RULE_INTEGRATION.md`
- `docs/mokxya-ai/baselines/MAI_38_SLICE1_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/tax_calculator_rule_integration_service.py`
