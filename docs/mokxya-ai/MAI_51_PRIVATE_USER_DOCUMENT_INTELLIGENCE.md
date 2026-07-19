# MAI-51 — Private User-Document Intelligence

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0068](decisions/ADR_0068_PRIVATE_USER_DOCUMENT_INTELLIGENCE_AUTHORITY.md)  
**Runtime:** `mai-51.0.2-slice2` (engineering; not production-approved)

## Objective

Declare a candidate policy for private user-document intelligence topics
(private document, user upload, document Q&A / summary / extraction,
retention policy, access control) and consume those into `CANDIDATE_ONLY`
document candidates without ingesting documents, indexing content, or
enabling live document Q&A.

## Slice 1

1. Ingress `PRIVATE_USER_DOCUMENT_INTELLIGENCE_*` after
   NEPALI_ENGLISH_SPEECH_CHANNEL
2. Semantic input: cue detection (not MAI-50 speech enablement)
3. Scope: `PRIVATE_USER_DOCUMENT_INTELLIGENCE_CANDIDATE_ONLY`
4. Release / gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `private_document_intelligence_enabled=false`;
   `document_ingested=false`; `document_indexed=false`;
   `document_qa_live=false`; `retention_policy_applied=false`;
   `access_control_enforced=false`;
   `cross_tenant_isolation_proven=false`;
   `documents_retrieved=0`
7. GAP-P2-008 OPEN (and other open gaps remain open)

## Slice 2

1. Consume service builds `private_user_document_intelligence_candidate`
2. Default mode `CANDIDATE_ONLY` (plans null; never applied)
3. Live ingress forces `allow_ingest=false`, `allow_qa=false`
4. Label-only invoke modes (`INVOKE_INGEST`, `INVOKE_QA`) for unit tests
   only — never on live path
5. Fake authority claim → `BLOCKED`; non-pilot → `SKIP`

## Gates

| Case | Expect |
|------|--------|
| Private document / upload / Q&A / summary / extraction / retention / access cues | COMPLETE → `POLICY_DECLARED` → consume `CANDIDATE_ONLY` |
| Purchase / VAT / speech-only without document cues | SKIP |
| Fake ingest / QA live claim | BLOCKED |
| Any live path | never ingest / never index / never QA live; gaps OPEN |

## Non-goals

- Document ingest or indexing
- Live document Q&A
- Closing GAP-P2-008 or GAP-P0-001
- Claiming cross-tenant isolation proven
