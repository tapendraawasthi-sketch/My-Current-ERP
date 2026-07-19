# ADR_0030 — Conversation and Object-Reference Store Authority

- **Status:** Accepted (2026-07-19); slice 2 addendum same day
- **Phase:** MAI-13-CONVERSATION-AND-OBJECT-REFERENCE-STORE (slice 2)
- **Extends:** ADR_0003 (canonical contracts), ADR_0029

## Context

Drafts live in file-backed khata stores and opaque `active_draft_reference`
strings. Conversation SQLite stores messages only. Turn-relation (MAI-14) and
stale-draft merge risks (GAP-P1-004/008) need a typed, candidate-only view of
which conversation objects are in play before any draft merge.

## Decision

1. MAI-13 owns **object-reference candidates** via `ObjectReferenceBundleV1` on
   `CanonicalAIRequestV1` — annotation only; never mutates khata drafts, never
   merges, never posts.
2. Slice 1 captures request-local references: `CONVERSATION`, `ACTIVE_DRAFT`,
   optional UI context object ids — with `silent_applications=0`.
3. Slice 2 adds **read-only store resolutions** (`ObjectReferenceResolutionV1`)
   by peeking khata draft JSON files and `oip_conversations` — existence and
   pending/terminal status only; never merge authority.
4. Does **not** classify turn-relation (MAI-14) or change `start_or_merge_*`.
5. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Merge drafts from references alone | Silent stale capture (GAP-P1-004) |
| Replace file draft stores in slice 1 | Too large; wrong authority |
| Close GAP-P1-008 in this phase | Requires MAI-14 turn-relation |
| Import khata writers for resolution | Mutation risk; RO file/SQLite peek suffices |

## Related

- `docs/mokxya-ai/MAI_13_CONVERSATION_AND_OBJECT_REFERENCE_STORE.md`
- `docs/mokxya-ai/MAI_13_OBJECT_REFERENCE_STORE_RESOLUTION.md`
- `erp_bot/src/oip/modules/conversation/application/object_reference_service.py`
- `erp_bot/src/oip/modules/conversation/application/object_reference_resolution_service.py`
