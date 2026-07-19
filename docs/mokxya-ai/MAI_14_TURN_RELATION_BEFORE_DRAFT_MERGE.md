# MAI-14 — Turn Relation Before Draft Merge

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0031](decisions/ADR_0031_TURN_RELATION_BEFORE_DRAFT_MERGE_AUTHORITY.md)  
**Runtime:** `mai-14.0.1-slice1` (engineering; not production-approved)

## Objective

Decide how the current turn relates to active drafts / prior context **before**
any draft merge — first as annotation, then as a merge gate.

## Slice 1

1. Attach `TurnRelationV1` on `CanonicalAIRequestV1` after MAI-13 object refs
2. Deterministic classifier using text cues + store resolutions
3. Metadata `turn_relation` for orchestrator visibility
4. Never call `start_or_merge_*`; never treat confirmation as post authority
5. `evals/mai14` + baseline

## Gates

| Case | Expect |
|------|--------|
| New-topic text + pending FOUND | `NEW_TOPIC` |
| Active draft `NOT_PENDING` | not `CONTINUE_*` |
| Cancel / yes / cash / make it N | matching kind |
| Decision | `is_execution_authority=false`; raw_text unchanged |

## Non-goals

- Changing `mode_aware_erp` merge (slice 2)
- Closing GAP-P1-004 / GAP-P1-008
- Full MAI-04 `context_turn_relation_v1` green
- Production approval
