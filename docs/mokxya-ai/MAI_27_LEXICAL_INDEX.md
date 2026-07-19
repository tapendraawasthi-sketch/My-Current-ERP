# MAI-27 — Lexical Index

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0044](decisions/ADR_0044_LEXICAL_INDEX_AUTHORITY.md)  
**Runtime:** `mai-27.0.1-slice1` (engineering; not production-approved)

## Objective

Annotate SQLITE FTS lexical-index readiness on the request path as an
Ollama-independent production retrieval backend — without running queries,
mutating indexes, or claiming citation verification.

## Slice 1

1. Ingress `LEXICAL_INDEX_*` after TEMPORAL_CROSS_REF
2. `LexicalIndexBundleV1` when knowledge-source governance is COMPLETE
3. Probe `kb_grounding.sqlite` (preferred) or `kb_lexical.sqlite` + `prod_fts`
4. `ollama_required=false`; `vector_backend_required=false`
5. `citations_verified=false`; `query_executions=0`

## Slice 2 (planned)

Prefer / consume lexical retrieval when COMPLETE + `fts_ready` (no Ollama).

## Gates

| Case | Expect |
|------|--------|
| COMPLETE governance + index | COMPLETE; `fts_ready` when schema present |
| OOD / governance SKIP | SKIP |
| Any bundle | no MATCH query; no Ollama/vector requirement |
| Citations | never verified in this phase |

## Non-goals

- Hybrid fusion / rerank (MAI-29)
- Claim-citation verification (MAI-30)
- Closing GAP-P2-001 / GAP-P2-008
- Production approval
