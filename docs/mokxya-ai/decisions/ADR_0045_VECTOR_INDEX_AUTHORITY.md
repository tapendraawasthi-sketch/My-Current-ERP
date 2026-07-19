# ADR_0045 — Multilingual Vector Index Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-28-MULTILINGUAL-VECTOR-INDEX (slice 1)
- **Extends:** ADR_0001, ADR_0041, ADR_0044

## Context

MAI-27 made SQLITE FTS the preferred production NP KB path. An optional Chroma
semantic index exists (`knowledgebase/indexes/semantic`) but embedding requires
local Ollama (`nomic-embed-text`) — unsuitable as a production dependency
(GAP-P2-001). MAI-28 must annotate vector readiness honestly without enabling
Ollama-gated retrieval on the production chat path.

## Decision

1. MAI-28 owns `VectorIndexBundleV1` on `CanonicalAIRequestV1` after
   LEXICAL_INDEX.
2. Slice 1: when knowledge-source governance is COMPLETE, probe semantic/
   Chroma presence; declare `vector_backend=CHROMA_OLLAMA`;
   `ollama_required=true`; `production_eligible=false`;
   `citations_verified=false`; `embed_invocations=0`; `query_executions=0`;
   `is_execution_authority=false`.
3. Slice 1 never calls Ollama, Chroma query, or mutates indexes.
4. Lexical remains the production-safe retrieval path; vector is
   development/partial only until a provider-independent embed path exists.
5. GAP-P2-001 / GAP-P2-008 stay OPEN; GAP-P1-004 / GAP-P1-008 stay REDUCED.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Claim vector production-eligible | Requires Ollama; violates GAP-P2-001 |
| Embed/query during annotation | Side effects / wrong slice |
| Override lexical with semantic | Safety / authority (lexical preferred) |
| Claim citations verified | GAP-P2-008 still OPEN |

## Related

- `docs/mokxya-ai/MAI_28_MULTILINGUAL_VECTOR_INDEX.md`
- `erp_bot/src/oip/modules/conversation/application/vector_index_service.py`
