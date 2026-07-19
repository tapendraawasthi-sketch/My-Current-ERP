# ADR_0059 — Judicial/Decision Intelligence Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-42-JUDICIAL-DECISION-INTELLIGENCE (slice 1)
- **Extends:** ADR_0001, ADR_0053, ADR_0058

## Context

MAI-36–41 cover legal research through broader business-law domain-release
candidates. Judicial/decision intelligence (holdings, issues, case status,
citator-like subsequent treatment) needs an explicit candidate policy before
any case retrieval or binding-rule claims. GAP-P2-008 and unproven effective
dates remain open.

## Decision

1. MAI-42 owns `JudicialDecisionIntelligenceBundleV1` on
   `CanonicalAIRequestV1` after BROADER_NEPAL_BUSINESS_LAW_DOMAIN_RELEASE.
2. Semantic gate: MAI-36 research COMPLETE + active + readiness in
   `{POLICY_DECLARED, CLARIFY_REQUIRED}` — **not** MAI-41 domain release
   (domain release must stay NOT_RELEASED / never gate judicial work).
3. Slice 1: declare
   `pilot_scope=JUDICIAL_DECISION_CANDIDATE_ONLY`,
   `release_status=NOT_RELEASED`,
   `gold_questions_status=NOT_RELEASED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `judicial_authority_claimed=false`,
   `headnote_as_binding_rule=false`,
   `subsequent_treatment_definitive=false`,
   `case_retrieved=false`,
   `holdings_extracted=false`,
   `citator_links_claimed=false`,
   `paragraph_anchors_claimed=false`,
   `legal_effective_dates_proven=false`,
   `gap_p2_008_status=OPEN`.
4. Never invent judicial authority, treat headnotes as full binding rules,
   or claim definitive subsequent treatment.
5. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-41 domain_released | Domain release must stay false / NOT_RELEASED |
| Case retrieval in slice 1 | Honesty / corpus / specialist review required |
| Headnote as binding rule | Roadmap gate forbids it |
| Close GAP-P2-008 | Honesty review still required |
| Prove effective dates | Must stay false |

## Related

- `docs/mokxya-ai/MAI_42_JUDICIAL_DECISION_INTELLIGENCE.md`
- `docs/mokxya-ai/baselines/MAI_42_SLICE1_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/judicial_decision_intelligence_service.py`
