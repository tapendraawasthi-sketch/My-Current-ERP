# ADR_0060 — Continuous Change Intelligence Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-43-CONTINUOUS-CHANGE-INTELLIGENCE (slice 1)
- **Extends:** ADR_0001, ADR_0053, ADR_0059

## Context

MAI-36–42 cover legal research through judicial/decision candidates. Continuous
change intelligence (amendments, gazettes, circulars, effective-date / rate
changes) needs an explicit candidate policy before any apply, cache invalidate,
or production-truth claim. GAP-P2-008 and unproven effective dates remain open.

## Decision

1. MAI-43 owns `ContinuousChangeIntelligenceBundleV1` on
   `CanonicalAIRequestV1` after JUDICIAL_DECISION_INTELLIGENCE.
2. Semantic gate: MAI-36 research COMPLETE + active + readiness in
   `{POLICY_DECLARED, CLARIFY_REQUIRED}` — **not** MAI-42 case retrieval
   (case_retrieved must stay false / never gate change work).
3. Slice 1: declare
   `pilot_scope=CONTINUOUS_CHANGE_CANDIDATE_ONLY`,
   `release_status=NOT_RELEASED`,
   `gold_questions_status=NOT_RELEASED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `continuous_change_authority_claimed=false`,
   `unreviewed_as_production_truth=false`,
   `cache_invalidated=false`,
   `rates_changed_as_truth=false`,
   `change_applied=false`,
   `amendment_applied=false`,
   `rollback_executed=false`,
   `legal_effective_dates_proven=false`,
   `gap_p2_008_status=OPEN`.
4. Never treat unreviewed detections as production truth, apply amendments,
   or prove effective dates.
5. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-42 case_retrieved | Judicial retrieve must stay false |
| Apply amendment / invalidate cache in slice 1 | Honesty / review / rollback required |
| Unreviewed detection as production truth | Roadmap gate forbids it |
| Prove effective dates | Must stay false |
| Close GAP-P2-008 | Honesty review still required |

## Related

- `docs/mokxya-ai/MAI_43_CONTINUOUS_CHANGE_INTELLIGENCE.md`
- `docs/mokxya-ai/baselines/MAI_43_SLICE1_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/continuous_change_intelligence_service.py`
