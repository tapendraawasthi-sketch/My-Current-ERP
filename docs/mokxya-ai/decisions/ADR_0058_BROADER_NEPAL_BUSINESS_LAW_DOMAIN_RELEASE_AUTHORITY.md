# ADR_0058 — Broader Nepal Business-Law Domain Release Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-41-BROADER-NEPAL-BUSINESS-LAW-DOMAIN-RELEASES (slice 1)
- **Extends:** ADR_0001, ADR_0053, ADR_0047

## Context

MAI-37–40 cover tax pilot, calculator/rule candidates, NFRS/NAS, and financial
close assistance. Broader Nepal business-law domains (company / labor /
contract) need an explicit candidate-release policy before any production
domain cutover. GAP-P2-008 and unproven effective dates remain open.

## Decision

1. MAI-41 owns `BroaderNepalBusinessLawDomainReleaseBundleV1` on
   `CanonicalAIRequestV1` after FINANCIAL_CLOSE_ADJUSTMENT_ASSISTANCE.
2. Semantic gate: MAI-36 research COMPLETE + active + readiness in
   `{POLICY_DECLARED, CLARIFY_REQUIRED}` — **not** MAI-40 close-assist
   readiness (too narrow).
3. Slice 1: declare
   `pilot_scope=BROADER_NEPAL_BUSINESS_LAW_CANDIDATE_ONLY`,
   `release_status=NOT_RELEASED`,
   `gold_questions_status=NOT_RELEASED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `domain_authority_claimed=false`,
   `domain_released=false`,
   `production_domain_eligible=false`,
   `legal_effective_dates_proven=false`,
   `gap_p2_008_status=OPEN`.
4. Never invent domain authority or expand to all Nepal law.
5. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-40 close-assist | Too narrow; business-law ≠ close |
| Production domain release in slice 1 | Honesty / specialist review required |
| Close GAP-P2-008 | Honesty review still required |
| Prove effective dates | Must stay false |

## Related

- `docs/mokxya-ai/MAI_41_BROADER_NEPAL_BUSINESS_LAW_DOMAIN_RELEASES.md`
- `docs/mokxya-ai/baselines/MAI_41_SLICE1_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/broader_nepal_business_law_domain_release_service.py`
