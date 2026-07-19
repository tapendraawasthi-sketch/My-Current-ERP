# ADR_0044 — Lexical Index Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-27-LEXICAL-INDEX (slice 1)
- **Extends:** ADR_0001, ADR_0041, ADR_0043

## Context

MAI-26 owns temporal/cross-ref cues and as_of retrieval hints. Production chat
must not depend on Ollama/Chroma for Nepali Language KB retrieval (GAP-P2-001).
`kb_lexical.sqlite` / `kb_grounding.sqlite` already exist as SQLITE FTS indexes;
MAI-27 must make that path an explicit, fail-closed request annotation before
preferring it in consume slices.

## Decision

1. MAI-27 owns `LexicalIndexBundleV1` on `CanonicalAIRequestV1` after
   TEMPORAL_CROSS_REF.
2. Slice 1: when knowledge-source governance is COMPLETE, probe active lexical
   DB presence and `prod_fts` schema readiness; never run MATCH / user queries;
   `ollama_required=false`; `vector_backend_required=false`;
   `citations_verified=false`; `documents_retrieved=0`; `query_executions=0`;
   `index_mutations=0`; `is_execution_authority=false`.
3. Slice 2+ may prefer/consume lexical retrieval when COMPLETE + `fts_ready`;
   slice 1 does not retrieve.
4. Prefer `kb_grounding.sqlite` over `kb_lexical.sqlite` when both exist
   (aligned with NP KB adapter).
5. GAP-P2-001 / GAP-P2-008 stay OPEN; GAP-P1-004 / GAP-P1-008 stay REDUCED.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Require Ollama/Chroma for prod KB | GAP-P2-001 / Render mismatch |
| Run MATCH queries in annotation | Side effects / wrong slice |
| Claim citations verified | GAP-P2-008 still OPEN |
| Mutate or rebuild indexes on chat path | Wrong lifecycle (MAI-12) |

## Related

- `docs/mokxya-ai/MAI_27_LEXICAL_INDEX.md`
- `erp_bot/src/oip/modules/conversation/application/lexical_index_service.py`
