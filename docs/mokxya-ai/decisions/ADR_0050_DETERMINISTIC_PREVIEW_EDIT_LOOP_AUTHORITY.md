# ADR_0050 — Deterministic Preview / Edit-Loop Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-33-DETERMINISTIC-PREVIEW-AND-EDIT-LOOP (slice 1)
- **Extends:** ADR_0001, ADR_0049

## Context

MAI-32 annotates durable draft readiness and emits DraftAggregate candidates
without `save_*`. Live previews today come from khata `preview_message` /
confirmation cards after mode_aware drafts. GAP-P2-002 tracks UI calculating
authoritative-looking totals. MAI-33 must declare preview/edit-loop policy and
calc ownership before any engine preview or card generation. CR-33-01/02 keep
mode_aware / OrbixWorkspace / invoice UI off the heavy Cursor lane for now.

## Decision

1. MAI-33 owns `DeterministicPreviewEditLoopBundleV1` on
   `CanonicalAIRequestV1` after DURABLE_VERSIONED_DRAFT.
2. Slice 1: when durable draft is COMPLETE + EPHEMERAL_LOCAL_JSON with a
   module, declare `preview_readiness=POLICY_DECLARED`,
   `edit_loop_policy=INVALIDATE_PREVIEW_ON_EDIT`,
   `stale_preview_on_confirm=REJECT`,
   `calc_authority_on_confirm=DEXIE_DOMAIN_ENGINE`,
   `gap_p2_002_status=OPEN`.
3. Slice 1 never generates previews/cards, never mints `preview_hash`, never
   journal-maths, never mutates drafts: all execute/mutate flags false /
   zero; `is_execution_authority=false`.
4. Aggregate-pending durable drafts → `preview_readiness=BLOCKED`; missing
   durable draft → SKIP. Do not invent preview success.
5. Slice 2+ may consume into preview candidates / gates; still no AI
   authoritative balancing; Dexie remains calc authority on confirm.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Call preview_message in annotation | Side effects / wrong slice |
| UI authoritative totals | GAP-P2-002 / dual calc |
| AI journal math for preview | Authority violation |
| Close GAP-P2-002 in slice 1 | Needs UI/engine work + review |

## Related

- `docs/mokxya-ai/MAI_33_DETERMINISTIC_PREVIEW_AND_EDIT_LOOP.md`
- `erp_bot/src/oip/modules/conversation/application/deterministic_preview_edit_loop_service.py`
