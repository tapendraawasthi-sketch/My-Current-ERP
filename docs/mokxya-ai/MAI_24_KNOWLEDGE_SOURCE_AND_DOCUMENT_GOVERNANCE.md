# MAI-24 — Knowledge Source and Document Governance

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0041](decisions/ADR_0041_KNOWLEDGE_SOURCE_GOVERNANCE_AUTHORITY.md)  
**Runtime:** `mai-24.0.2-slice2` (engineering; not production-approved)

## Objective

Annotate allowed/blocked knowledge retrieval collections from router domain,
then consume that policy in NP KB / provider grounding — without mutating
indexes or granting posting authority.

## Slice 1

1. Ingress `KNOWLEDGE_SOURCE_GOVERNANCE_*` after PROMPT_REGISTRY
2. `KnowledgeSourceGovernanceBundleV1` on `CanonicalAIRequestV1`
3. COMPLETE non-OOD router → domain→collections map
4. `evaluation_only` always blocked; `allow_evaluation_corpus=false`
5. OOD / incomplete router → SKIP
6. `documents_retrieved=0`; `is_execution_authority=false`

## Slice 2

1. Forward governance into `policy_decisions` before grounding
2. COMPLETE → filter lexical citations by allowed collections
3. SKIP / FAILED → skip NP KB retrieval (`GOVERNANCE_SKIP`)
4. `evaluation_only` never joined into production FTS path
5. Bundle counters remain zero (annotation authority unchanged)

## Gates

| Case | Expect |
|------|--------|
| Accounting purchase | COMPLETE; filter applied; no eval corpus |
| OOD gibberish | SKIP; NP KB skipped |
| Any COMPLETE | `evaluation_only` blocked |
| Annotation bundle | `documents_retrieved=0` |

## Non-goals

- Closing GAP-P2-008 / GAP-P1-004 / GAP-P1-008
- Production approval
