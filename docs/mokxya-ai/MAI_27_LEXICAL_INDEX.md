# MAI-27 — Lexical Index

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING`  
**Authority:** [ADR_0044](decisions/ADR_0044_LEXICAL_INDEX_AUTHORITY.md)  
**Runtime:** `mai-27.0.2-slice2` (engineering; not production-approved)

## Objective

Annotate SQLITE FTS lexical-index readiness, then prefer lexical-only NP KB
retrieval when ready — without requiring Ollama/vector or claiming citation
verification.

## Slice 1

1. Ingress `LEXICAL_INDEX_*` after TEMPORAL_CROSS_REF
2. `LexicalIndexBundleV1` when knowledge-source governance is COMPLETE
3. Probe `kb_grounding.sqlite` (preferred) or `kb_lexical.sqlite` + `prod_fts`
4. `ollama_required=false`; `vector_backend_required=false`
5. `citations_verified=false`; `query_executions=0` (annotation)

## Slice 2

1. `should_prefer_lexical_retrieval` → COMPLETE + `fts_ready`
2. NP KB / `build_prompt_grounding`: force `lexical_enabled=True`,
   `semantic_enabled=False` (`LEXICAL_ONLY`)
3. COMPLETE but not ready → `LEXICAL_INDEX_NOT_READY` (fail-closed)
4. False `ollama_required` / `citations_verified` / execution flags → block
5. Forward `lexical_index` into `policy_decisions`

## Gates

| Case | Expect |
|------|--------|
| COMPLETE + fts_ready | LEXICAL_ONLY; semantic forced off |
| COMPLETE + missing index | BLOCKED / LEXICAL_INDEX_NOT_READY |
| OOD / governance SKIP | lexical UNCHANGED (gov may skip) |
| Authority flag true | block consume |
| Citations | never verified in this phase |

## Non-goals

- Hybrid fusion / rerank (MAI-29)
- Claim-citation verification (MAI-30)
- Closing GAP-P2-001 / GAP-P2-008
- Production approval
