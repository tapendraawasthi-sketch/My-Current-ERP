# ADR_0050 — Deterministic Preview / Edit-Loop Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-33-DETERMINISTIC-PREVIEW-AND-EDIT-LOOP (slice 2)
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
5. Slice 2: consume builds `preview_candidate` / `preview_consume_mode`
   (`CANDIDATE_ONLY` default; `BLOCKED` for blocked readiness / fake
   authority; `SKIP` for read-only). Live path forces
   `allow_preview_generate=false` — does **not** call `preview_message` or
   emit cards. Still no AI journal math; Dexie remains calc authority on
   confirm; GAP-P2-002 stays OPEN.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Call preview_message in annotation | Side effects / wrong slice |
| Live cards in slice 2 | CR-33-01; GAP-P2-002 risk |
| UI authoritative totals | GAP-P2-002 / dual calc |
| AI journal math for preview | Authority violation |
| Close GAP-P2-002 in slice 1–2 | Needs UI/engine work + review |

## Related

- `docs/mokxya-ai/MAI_33_DETERMINISTIC_PREVIEW_AND_EDIT_LOOP.md`
- `docs/mokxya-ai/baselines/MAI_33_SLICE2_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/deterministic_preview_edit_loop_service.py`
- `erp_bot/src/oip/modules/conversation/application/deterministic_preview_edit_loop_consume_service.py`
