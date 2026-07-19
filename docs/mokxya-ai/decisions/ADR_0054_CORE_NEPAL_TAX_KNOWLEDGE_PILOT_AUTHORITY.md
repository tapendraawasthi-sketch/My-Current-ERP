# ADR_0054 — Core Nepal Tax Knowledge Pilot Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-37-CORE-NEPAL-TAX-KNOWLEDGE-PILOT (PASSED_ENGINEERING; not production-approved)
- **Extends:** ADR_0001, ADR_0053, ADR_0047

## Context

MAI-36 frames legal/tax questions into research mode without proving law.
MAI-37 must declare a narrow Income Tax / VAT / TDS knowledge pilot scope
before any rate authority, gold release, or tax calculator (MAI-38).
GAP-P2-008 and unproven effective dates remain open.

## Decision

1. MAI-37 owns `CoreNepalTaxKnowledgePilotBundleV1` on
   `CanonicalAIRequestV1` after LEGAL_QUESTION_RESEARCH.
2. Semantic gate: MAI-36 research COMPLETE + active + readiness in
   `{POLICY_DECLARED, CLARIFY_REQUIRED}`; not offline-sync readiness.
3. Slice 1: declare `pilot_scope=INCOME_TAX_VAT_TDS_ONLY`, in-scope topic
   tags, approved-source policy, rate tables as `CANDIDATE_REFS_ONLY`,
   `gold_questions_status=NOT_RELEASED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `tax_calculator_invoked=false`,
   `legal_effective_dates_proven=false`,
   `gap_p2_008_status=OPEN`.
4. Unsupported topics (customs/excise/NFRS/etc.) documented; may BLOCK or
   SCOPE_PARTIAL. Never invent rates or expand to all Nepal law.
5. Slice 2: consume builds `tax_pilot_candidate` / `tax_pilot_consume_mode`
   (`CANDIDATE_ONLY` default for POLICY_DECLARED / SCOPE_PARTIAL; `BLOCKED`
   for fake authority; `SKIP` for non-pilot). Live path forces
   `allow_rate_lookup=false` and `allow_tax_calculator=false` — does **not**
   execute rate lookup, tax calculator, or definitive law. GAP-P2-008 stays
   OPEN.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| All-Nepal-law pilot | Roadmap narrows to IT/VAT/TDS |
| Tax calculator in slice 1–2 | MAI-38 |
| Live rate lookup in slice 2 | Authority / honesty risk |
| Specialist sign-off claimed | Review not done |
| Close GAP-P2-008 | Honesty review still required |
| Prove effective dates | Must stay false |

## Related

- `docs/mokxya-ai/MAI_37_CORE_NEPAL_TAX_KNOWLEDGE_PILOT.md`
- `docs/mokxya-ai/baselines/MAI_37_SLICE2_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/core_nepal_tax_knowledge_pilot_service.py`
- `erp_bot/src/oip/modules/conversation/application/core_nepal_tax_knowledge_pilot_consume_service.py`
