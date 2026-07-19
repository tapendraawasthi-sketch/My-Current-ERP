# ADR_0065 — Governed Improvement and Optional Fine-Tuning Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-48-GOVERNED-IMPROVEMENT-AND-OPTIONAL-FINE-TUNING (slice 2)
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
4. Slice 2: consume builds `governed_improvement_fine_tuning_candidate` /
   `governed_improvement_fine_tuning_consume_ready` under default
   `CANDIDATE_ONLY`. Improvement proposal, fine-tune plan, eval regression
   plan, dataset curation plan, prompt iteration plan, model swap plan,
   ablation plan, and definitive answer stay null. Live ingress forces
   `allow_fine_tune=false` and `allow_model_swap=false`. Label-only invoke
   modes exist for unit tests only.
5. Never invent applied improvements, executed fine-tunes, or production model
   swaps from cue detection alone.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-47 human_review_complete | Review must stay incomplete |
| Apply improvements / fine-tune in slice 1–2 | Owner governance + regression required |
| Live fine-tune / model swap in slice 2 | Authority / honesty risk |
| Silent training-data export | Privacy / authority risk |
| Close GAP-P2-008 | Honesty review still required |
| Production model swap | Explicit production release is later |

## Related

- `docs/mokxya-ai/MAI_48_GOVERNED_IMPROVEMENT_FINE_TUNING.md`
- `docs/mokxya-ai/baselines/MAI_48_SLICE1_BASELINE_SUMMARY.md`
- `docs/mokxya-ai/baselines/MAI_48_SLICE2_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/governed_improvement_fine_tuning_service.py`
- `erp_bot/src/oip/modules/conversation/application/governed_improvement_fine_tuning_consume_service.py`
