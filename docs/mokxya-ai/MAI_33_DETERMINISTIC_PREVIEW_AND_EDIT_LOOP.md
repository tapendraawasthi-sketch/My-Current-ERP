# MAI-33 — Deterministic Preview and Edit Loop

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING`  
**Authority:** [ADR_0050](decisions/ADR_0050_DETERMINISTIC_PREVIEW_EDIT_LOOP_AUTHORITY.md)  
**Runtime:** `mai-33.0.2-slice2` (engineering; not production-approved)

## Objective

Annotate preview readiness, edit→invalidate/`preview_hash` policy, and calc
ownership — then consume into preview candidates — without generating
confirmation cards or mutating drafts.

## Slice 1

1. Ingress `DETERMINISTIC_PREVIEW_EDIT_LOOP_*` after DURABLE_VERSIONED_DRAFT
2. `DeterministicPreviewEditLoopBundleV1` from MAI-32 durable state
3. `preview_readiness=POLICY_DECLARED` when draft module ready
4. `edit_loop_policy=INVALIDATE_PREVIEW_ON_EDIT`; stale → `REJECT`
5. `calc_authority_on_confirm=DEXIE_DOMAIN_ENGINE`; GAP-P2-002 remains OPEN
6. Never `preview_message` / cards / journal math / draft mutations

## Slice 2

1. `resolve_preview_consume_mode` / `build_preview_candidate`
2. Default `CANDIDATE_ONLY` — merges MAI-31 `field_overrides`; `preview_hash=null`
3. Blocked readiness / fake authority → `BLOCKED`; read-only → `SKIP`
4. Live path forces `allow_preview_generate=false` (no cards / preview_message)
5. Metadata: `preview_consume_ready` + `preview_candidate`

## Gates

| Case | Expect |
|------|--------|
| purchase durable ready | COMPLETE → `CANDIDATE_ONLY` preview candidate |
| Blocked readiness / fake generate | `BLOCKED` |
| report / OOD / no DVD | SKIP |
| Any live path | never preview_generated; GAP-P2-002 OPEN |

## Non-goals

- Live preview cards / `preview_message`
- Closing GAP-P2-002
- Confirm / OEC (MAI-34)
- Production approval
