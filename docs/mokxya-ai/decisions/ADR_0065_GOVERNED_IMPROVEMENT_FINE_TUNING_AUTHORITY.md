# ADR_0065 — Governed Improvement and Optional Fine-Tuning Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-48-GOVERNED-IMPROVEMENT-AND-OPTIONAL-FINE-TUNING (slice 1)
- **Extends:** ADR_0001, ADR_0003

## Context

MAI-36–47 cover legal research through human-review/pilot candidates.
Governed improvement and optional fine-tuning need an explicit candidate
policy before any improvement apply, fine-tune execution, or production model
swap.

## Decision

1. MAI-48 owns `GovernedImprovementFineTuningBundleV1` on
   `CanonicalAIRequestV1` after HUMAN_REVIEW_PILOT_OPERATIONS.
2. Semantic gate: cue detection only (governed improvement / fine-tuning /
   eval regression / dataset curation / prompt iteration / model swap /
   ablation) — **not** MAI-47 review complete or go-live.
3. Slice 1: declare
   `pilot_scope=GOVERNED_IMPROVEMENT_FINE_TUNING_CANDIDATE_ONLY`,
   `release_status=NOT_RELEASED`,
   `gold_questions_status=NOT_RELEASED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `improvement_applied=false`,
   `fine_tuning_executed=false`,
   `training_data_exported=false`,
   `model_weights_changed=false`,
   `production_model_swapped=false`,
   `regression_suite_passed=false`,
   `governed_change_approved=false`,
   `gap_p2_008_status=OPEN`.
4. Never invent applied improvements, executed fine-tunes, or production model
   swaps from cue detection alone.
5. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-47 human_review_complete | Review must stay incomplete |
| Apply improvements / fine-tune in slice 1 | Owner governance + regression required |
| Silent training-data export | Privacy / authority risk |
| Production model swap | Explicit production release is later |
| Close GAP-P2-008 | Honesty review still required |

## Related

- `docs/mokxya-ai/MAI_48_GOVERNED_IMPROVEMENT_FINE_TUNING.md`
- `docs/mokxya-ai/baselines/MAI_48_SLICE1_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/governed_improvement_fine_tuning_service.py`
