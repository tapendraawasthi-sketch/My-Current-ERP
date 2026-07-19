# MAI-14 — Turn Relation Before Draft Merge

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING` (slices 1–2; `production_approved=false`)  
**Authority:** [ADR_0031](decisions/ADR_0031_TURN_RELATION_BEFORE_DRAFT_MERGE_AUTHORITY.md)  
**Runtime:** `mai-14.0.2-slice2` (engineering; not production-approved)

## Objective

Decide how the current turn relates to active drafts / prior context **before**
any draft merge — first as annotation, then as a merge gate.

## Slice 1

1. Attach `TurnRelationV1` on `CanonicalAIRequestV1` after MAI-13 object refs
2. Deterministic classifier using text cues + store resolutions
3. Metadata `turn_relation` for orchestrator visibility
4. Never treat confirmation as post authority
5. `evals/mai14` + baseline

## Slice 2

1. Thread `metadata.turn_relation` into `preprocess_erp_message` / `handle_mode_aware_erp`
2. `allows_pending_merge` clears all pending/`existing` before `classify_operation`
3. Fail-closed for `NEW_TOPIC` / `UNKNOWN` / `CONFIRMATION_INTENT` / `CANCEL_*` / `FAILED`
4. Allow clarify/continue/correct relations to merge
5. GAP-P1-004 / GAP-P1-008 marked **REDUCED** (not closed; MAI-04 suite not fully green)

## Gates

| Case | Expect |
|------|--------|
| `NEW_TOPIC` + pending | no clarification merge into stale draft |
| `ANSWER_CLARIFICATION` + pending | merge allowed |
| `CONFIRMATION_INTENT` | no merge; not post authority |
| `turn_relation=None` | legacy unit-test behavior |

## Non-goals

- Full MAI-04 `context_turn_relation_v1` green
- Cancel UX / draft deletion
- Production approval
