# MAI-28 — Multilingual Vector Index

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING`  
**Authority:** [ADR_0045](decisions/ADR_0045_VECTOR_INDEX_AUTHORITY.md)  
**Runtime:** `mai-28.0.2-slice2` (engineering; not production-approved)

## Objective

Annotate Chroma/Ollama semantic vector-index readiness, then optionally allow
non-prod semantic filler — never as a production requirement; lexical stays
authoritative.

## Slice 1

1. Ingress `VECTOR_INDEX_*` after LEXICAL_INDEX
2. `VectorIndexBundleV1` when knowledge-source governance is COMPLETE
3. Probe `indexes/semantic` + `chroma/`; note status JSON if present
4. `vector_backend=CHROMA_OLLAMA`; `ollama_required=true`
5. `production_eligible=false`; `citations_verified=false`
6. `embed_invocations=0`; `query_executions=0`

## Slice 2

1. `should_allow_non_prod_semantic_consume` requires COMPLETE + chroma +
   `ORBIX_NP_KB_SEMANTIC_ENABLED` + `ORBIX_NP_KB_ALLOW_NON_PROD_SEMANTIC`
2. Default (no allow flag): force semantic off when vector annotation present
3. Allowed: `LEXICAL_PLUS_NON_PROD_SEMANTIC` (lexical first; semantic filler)
4. `production_eligible=true` claim → BLOCKED
5. Forward `vector_index` into `policy_decisions` with production stripped

## Gates

| Case | Expect |
|------|--------|
| Default prod path | LEXICAL_AUTHORITATIVE; semantic off |
| Allow + chroma | non-prod filler; lexical authoritative |
| Prod-eligible claim | BLOCKED |
| OOD / SKIP | no semantic enable |
| Citations | never verified |

## Non-goals

- Making Ollama a Render/prod dependency
- Hybrid fusion (MAI-29)
- Claim-citation verification (MAI-30)
- Closing GAP-P2-001 / GAP-P2-008
- Production approval
