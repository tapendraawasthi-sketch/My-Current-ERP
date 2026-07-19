# MAI-13 — Conversation and Object-Reference Store

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING` (slices 1–2; `production_approved=false`)  
**Authority:** [ADR_0030](decisions/ADR_0030_CONVERSATION_OBJECT_REFERENCE_STORE_AUTHORITY.md)  
**Runtime:** `mai-13.0.2-slice2` (engineering; not production-approved)

## Objective

Expose a typed, candidate-only snapshot of conversation object references
(active draft, conversation id, UI context ids) and resolve them read-only
against stores so MAI-14 turn-relation can bind drafts safely — without
merging or posting in this phase.

## Slice 1

1. `ObjectReferenceBundleV1` on `CanonicalAIRequestV1`
2. Build from `conversation_id`, `active_draft_reference`, `active_ui_context`
3. Wire attach in `oip_chat_ingress` after MAI-11
4. `evals/mai13` + baseline
5. Never call khata draft writers

## Slice 2

1. `ObjectReferenceResolutionV1` on the same bundle
2. Read-only peek of 6 khata draft JSON stores + `oip_conversations`
3. Statuses: `FOUND` / `MISSING` / `NOT_PENDING` / conversation found|missing|skipped
4. Metadata + ingress counters; still `silent_applications=0`
5. See [MAI_13_OBJECT_REFERENCE_STORE_RESOLUTION.md](MAI_13_OBJECT_REFERENCE_STORE_RESOLUTION.md)

## Gates

| Case | Expect |
|------|--------|
| Has `active_draft_reference` | candidate `ACTIVE_DRAFT` |
| Always | candidate `CONVERSATION` with conversation_id |
| Pending draft in store | resolution `FOUND` + `draft_kind` |
| Posted/cancelled draft | resolution `NOT_PENDING` |
| Bundle | `silent_applications=0`; no draft file writes |

## Non-goals

- Turn-relation classification (MAI-14)
- Changing `mode_aware_erp` merge behavior
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
