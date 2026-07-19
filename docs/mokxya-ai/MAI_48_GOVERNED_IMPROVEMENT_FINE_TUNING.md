# MAI-48 — Governed Improvement and Optional Fine-Tuning

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0065](decisions/ADR_0065_GOVERNED_IMPROVEMENT_FINE_TUNING_AUTHORITY.md)  
**Runtime:** `mai-48.0.1-slice1` (engineering; not production-approved)

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

## Gates

| Case | Expect |
|------|--------|
| Governed improvement / fine-tune / eval / dataset / prompt / model-swap / ablation cues | COMPLETE → `POLICY_DECLARED` |
| Purchase / VAT / review-only without improvement cues | SKIP |
| Any live path | never apply / never fine-tune / never swap; gap OPEN |

## Non-goals

- Applying governed improvements
- Executing fine-tuning / exporting training data
- Production model swap
- Closing GAP-P2-008
- Production capability release
