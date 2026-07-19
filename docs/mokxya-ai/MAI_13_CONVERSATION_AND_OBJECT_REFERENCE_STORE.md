# MAI-13 — Conversation and Object-Reference Store

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0030](decisions/ADR_0030_CONVERSATION_OBJECT_REFERENCE_STORE_AUTHORITY.md)  
**Runtime:** `mai-13.0.1-slice1` (engineering; not production-approved)

## Objective

Expose a typed, candidate-only snapshot of conversation object references
(active draft, conversation id, UI context ids) so MAI-14 turn-relation can
bind drafts safely — without merging or posting in this phase.

## Slice 1

1. `ObjectReferenceBundleV1` on `CanonicalAIRequestV1`
2. Build from `conversation_id`, `active_draft_reference`, `active_ui_context`
3. Wire attach in `oip_chat_ingress` after MAI-11
4. `evals/mai13` + baseline
5. Never call khata draft writers

## Gates

| Case | Expect |
|------|--------|
| Has `active_draft_reference` | candidate `ACTIVE_DRAFT` |
| Always | candidate `CONVERSATION` with conversation_id |
| Bundle | `silent_applications=0`; no draft file writes |

## Non-goals

- Turn-relation classification (MAI-14)
- Changing `mode_aware_erp` merge behavior
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
