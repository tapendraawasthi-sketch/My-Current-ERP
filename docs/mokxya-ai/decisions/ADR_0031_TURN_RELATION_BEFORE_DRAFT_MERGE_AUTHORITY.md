# ADR_0031 — Turn Relation Before Draft Merge Authority

- **Status:** Accepted (2026-07-19); slice 2 addendum same day
- **Phase:** MAI-14-TURN-RELATION-BEFORE-DRAFT-MERGE (slice 2)
- **Extends:** ADR_0003, ADR_0030

## Context

`mode_aware_erp` can merge follow-ups into pending drafts without a typed
turn-relation decision (GAP-P1-004 / GAP-P1-008). MAI-13 now exposes
store-resolved object references. Merge gating needs a classifier
decision that is not itself execution authority.

## Decision

1. MAI-14 owns `TurnRelationV1` on `CanonicalAIRequestV1`.
2. Slice 1: deterministic lexicon + MAI-13 resolution signals produce
   `relation` / `referenced_object_ids` / classifier version.
3. `CONFIRMATION_INTENT` never grants execution authority.
4. Slice 2: `allows_pending_merge` clears pending/`existing` in
   `handle_mode_aware_erp` before `classify_operation` when relation is
   not continue/clarify/correct. `turn_relation=None` keeps legacy tests.
5. GAP-P1-004 / GAP-P1-008 → **REDUCED** (not closed until MAI-04 suite proven).
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Treat CONFIRMATION_INTENT as post authority | Violates MAI-01 policy |
| Claim GAP closed without MAI-04 suite green | Overclaim |
| Fail-open on UNKNOWN | Reintroduces stale capture |

## Related

- `docs/mokxya-ai/MAI_14_TURN_RELATION_BEFORE_DRAFT_MERGE.md`
- `erp_bot/src/oip/modules/conversation/application/turn_relation_service.py`
- `erp_bot/src/oip/integration/mode_aware_erp.py`
