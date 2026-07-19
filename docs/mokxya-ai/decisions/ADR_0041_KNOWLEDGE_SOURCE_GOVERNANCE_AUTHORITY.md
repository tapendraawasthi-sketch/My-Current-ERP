# ADR_0041 — Knowledge Source / Document Governance Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-24-KNOWLEDGE-SOURCE-AND-DOCUMENT-GOVERNANCE (slice 1)
- **Extends:** ADR_0001, ADR_0040

## Context

MAI-23 owns prompt-template refs. Knowledge retrieval today can surface
evaluation corpora or unbounded collections without a request-path governance
annotation. MAI-24 must first own allowed/blocked collection policy without
retrieving documents or mutating indexes.

## Decision

1. MAI-24 owns `KnowledgeSourceGovernanceBundleV1` on `CanonicalAIRequestV1`
   after PROMPT_REGISTRY.
2. Slice 1: annotation-only allowed/blocked retrieval collections from
   COMPLETE non-OOD router domain; `evaluation_only` always blocked;
   `allow_evaluation_corpus=false`; `documents_retrieved=0`;
   `is_execution_authority=false`.
3. Does not call lexical/semantic search, index builders, or mutate drafts.
4. Slice 2 (later): consume policy into NP KB / grounding retrieval filters.
5. GAP-P2-008 stays OPEN; GAP-P1-004 / GAP-P1-008 stay REDUCED.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Retrieve documents in ingress | Side effects / wrong authority |
| Allow evaluation_only in production map | Citation honesty / eval leak |
| Grant posting from KB hits | Constitution violation |

## Related

- `docs/mokxya-ai/MAI_24_KNOWLEDGE_SOURCE_AND_DOCUMENT_GOVERNANCE.md`
- `erp_bot/src/oip/modules/conversation/application/knowledge_source_governance_service.py`
