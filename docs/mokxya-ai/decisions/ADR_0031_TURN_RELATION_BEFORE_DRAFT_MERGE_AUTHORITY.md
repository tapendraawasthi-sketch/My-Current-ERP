# ADR_0031 — Turn Relation Before Draft Merge Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-14-TURN-RELATION-BEFORE-DRAFT-MERGE (slice 1)
- **Extends:** ADR_0003, ADR_0030

## Context

`mode_aware_erp` can merge follow-ups into pending drafts without a typed
turn-relation decision (GAP-P1-004 / GAP-P1-008). MAI-13 now exposes
store-resolved object references. Merge gating still needs a classifier
decision that is not itself execution authority.

## Decision

1. MAI-14 owns `TurnRelationV1` on `CanonicalAIRequestV1` — annotation only.
2. Slice 1: deterministic lexicon + MAI-13 resolution signals produce
   `relation` / `referenced_object_ids` / `classifier_version=mai-14.0.1-slice1`.
3. `CONFIRMATION_INTENT` never grants execution authority.
4. Slice 1 does **not** change `mode_aware_erp` / `start_or_merge_*`.
5. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate merge in slice 1 without baseline | Couples UX risk to first classifier |
| Treat CONFIRMATION_INTENT as post authority | Violates MAI-01 policy |
| Close GAP-P1-004/008 without merge gate | Requires slice 2 consumption |

## Related

- `docs/mokxya-ai/MAI_14_TURN_RELATION_BEFORE_DRAFT_MERGE.md`
- `erp_bot/src/oip/modules/conversation/application/turn_relation_service.py`
