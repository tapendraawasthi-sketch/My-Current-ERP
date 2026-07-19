# MAI-28 — Multilingual Vector Index

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0045](decisions/ADR_0045_VECTOR_INDEX_AUTHORITY.md)  
**Runtime:** `mai-28.0.1-slice1` (engineering; not production-approved)

## Objective

Annotate Chroma/Ollama semantic vector-index readiness honestly — without
embedding, querying, or claiming production eligibility.

## Slice 1

1. Ingress `VECTOR_INDEX_*` after LEXICAL_INDEX
2. `VectorIndexBundleV1` when knowledge-source governance is COMPLETE
3. Probe `indexes/semantic` + `chroma/`; note status JSON if present
4. `vector_backend=CHROMA_OLLAMA`; `ollama_required=true`
5. `production_eligible=false`; `citations_verified=false`
6. `embed_invocations=0`; `query_executions=0`

## Slice 2 (planned)

Optional non-prod semantic consume only when explicitly enabled and never as
a production requirement (lexical remains authoritative).

## Gates

| Case | Expect |
|------|--------|
| COMPLETE + chroma present | COMPLETE; `production_eligible=false` |
| OOD / governance SKIP | SKIP |
| Any bundle | no embed/query; citations unverified |
| Production path | must not require this vector backend |

## Non-goals

- Making Ollama a Render/prod dependency
- Hybrid fusion (MAI-29)
- Claim-citation verification (MAI-30)
- Closing GAP-P2-001 / GAP-P2-008
- Production approval
