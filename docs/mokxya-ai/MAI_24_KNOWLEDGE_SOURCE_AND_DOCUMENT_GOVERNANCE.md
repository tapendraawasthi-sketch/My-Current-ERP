# MAI-24 — Knowledge Source and Document Governance

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0041](decisions/ADR_0041_KNOWLEDGE_SOURCE_GOVERNANCE_AUTHORITY.md)  
**Runtime:** `mai-24.0.1-slice1` (engineering; not production-approved)

## Objective

Annotate allowed/blocked knowledge retrieval collections and eligibility
policy on the canonical request from router domain — without retrieving
documents, mutating indexes, or granting posting authority.

## Slice 1

1. Ingress `KNOWLEDGE_SOURCE_GOVERNANCE_*` after PROMPT_REGISTRY
2. `KnowledgeSourceGovernanceBundleV1` on `CanonicalAIRequestV1`
3. COMPLETE non-OOD router → domain→collections map
4. `evaluation_only` always blocked; `allow_evaluation_corpus=false`
5. OOD / incomplete router → SKIP
6. `documents_retrieved=0`; `is_execution_authority=false`

## Gates

| Case | Expect |
|------|--------|
| Accounting purchase | COMPLETE; `accounting_and_erp` allowed |
| OOD gibberish | SKIP |
| Any COMPLETE | `evaluation_only` blocked |
| Any bundle | `documents_retrieved=0` |

## Non-goals

- Live retrieval filter consume (later slice)
- Closing GAP-P2-008 / GAP-P1-004 / GAP-P1-008
- Production approval
