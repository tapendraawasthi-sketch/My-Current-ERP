# MAI-48 — Governed Improvement and Optional Fine-Tuning

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING`  
**Authority:** [ADR_0065](decisions/ADR_0065_GOVERNED_IMPROVEMENT_FINE_TUNING_AUTHORITY.md)  
**Runtime:** `mai-48.0.2-slice2` (engineering; not production-approved)

## Objective

Declare a candidate policy for governed improvement and optional fine-tuning
topics (improvement proposals, fine-tuning/LoRA, eval regression, dataset
curation, prompt iteration, model swap, ablation) without applying changes,
executing fine-tunes, or swapping production models.

## Slice 1

1. Ingress `GOVERNED_IMPROVEMENT_FINE_TUNING_*` after
   HUMAN_REVIEW_PILOT_OPERATIONS
2. Semantic input: cue detection (not MAI-47 review complete / go-live)
3. Scope: `GOVERNED_IMPROVEMENT_FINE_TUNING_CANDIDATE_ONLY`
4. Release / gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `improvement_applied=false`; `fine_tuning_executed=false`;
   `production_model_swapped=false`; `governed_change_approved=false`
7. GAP-P2-008 OPEN

## Slice 2

1. `resolve_governed_improvement_fine_tuning_consume_mode` /
   `build_governed_improvement_fine_tuning_candidate`
2. Default `CANDIDATE_ONLY` — improvement / fine-tune / eval / dataset /
   prompt / model-swap / ablation plans / definitive = null
3. Fake fine-tune claim → `BLOCKED`; non-pilot → `SKIP`
4. Live path forces `allow_fine_tune=false` / `allow_model_swap=false`
5. Metadata: `governed_improvement_fine_tuning_consume_ready` +
   `governed_improvement_fine_tuning_candidate`

## Gates

| Case | Expect |
|------|--------|
| Governed improvement / fine-tune / eval / dataset / prompt / model-swap / ablation cues | COMPLETE → `CANDIDATE_ONLY` |
| Fake fine_tuning_executed claim | `BLOCKED` |
| Purchase / VAT / review-only without improvement cues | SKIP |
| Any live path | never apply / never fine-tune / never swap; gap OPEN |

## Non-goals

- Applying governed improvements
- Executing fine-tuning / exporting training data
- Production model swap
- Closing GAP-P2-008
- Production capability release
