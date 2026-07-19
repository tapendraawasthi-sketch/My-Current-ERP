# MAI-33 — Deterministic Preview and Edit Loop

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0050](decisions/ADR_0050_DETERMINISTIC_PREVIEW_EDIT_LOOP_AUTHORITY.md)  
**Runtime:** `mai-33.0.1-slice1` (engineering; not production-approved)

## Objective

Annotate preview readiness, edit→invalidate/`preview_hash` policy, and calc
ownership — without generating confirmation cards or mutating drafts.

## Slice 1

1. Ingress `DETERMINISTIC_PREVIEW_EDIT_LOOP_*` after DURABLE_VERSIONED_DRAFT
2. `DeterministicPreviewEditLoopBundleV1` from MAI-32 durable state
3. `preview_readiness=POLICY_DECLARED` when draft module ready
4. `edit_loop_policy=INVALIDATE_PREVIEW_ON_EDIT`; stale → `REJECT`
5. `calc_authority_on_confirm=DEXIE_DOMAIN_ENGINE`; GAP-P2-002 remains OPEN
6. Never `preview_message` / cards / journal math / draft mutations

## Slice 2 (planned)

Consume into preview candidates / gates (still no AI journal math; Dexie
remains confirm calc authority).

## Gates

| Case | Expect |
|------|--------|
| purchase durable ready | COMPLETE + POLICY_DECLARED |
| aggregate pending | COMPLETE + BLOCKED |
| report / OOD / no DVD | SKIP |
| Any bundle | never preview_generated; GAP-P2-002 OPEN |

## Non-goals

- Live preview cards / `preview_message`
- Closing GAP-P2-002
- Confirm / OEC (MAI-34)
- Production approval
