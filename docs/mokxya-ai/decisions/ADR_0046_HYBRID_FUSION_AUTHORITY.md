# ADR_0046 — Hybrid Fusion / Evidence Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-29-HYBRID-FUSION-RERANKING-EVIDENCE (slice 1)
- **Extends:** ADR_0001, ADR_0044, ADR_0045

## Context

MAI-27/28 made lexical FTS production-safe and gated Chroma/Ollama semantic as
non-prod. Local code already has RRF helpers (`hybrid_nlu_search`, knowledge
`HybridRankStage`), but request-path fusion/evidence policy is not annotated.
MAI-29 must declare fusion mode and evidence gates without claiming verification
or executing rerank on the chat path in slice 1.

## Decision

1. MAI-29 owns `HybridFusionBundleV1` on `CanonicalAIRequestV1` after
   VECTOR_INDEX.
2. Slice 1: when knowledge-source governance is COMPLETE, recommend
   `LEXICAL_ONLY` or `RRF_CANDIDATE` from lexical/vector readiness;
   `rrf_k=60`; `rerank_authorized=false`; `fusion_executed=false`;
   `evidence_assembled=false`; `evidence_item_count=0`;
   `claims_verified=false`; `citations_verified=false`;
   `hybrid_production_eligible=false`; `lexical_authoritative=true`;
   `is_execution_authority=false`.
3. Slice 1 never runs RRF, rerank, or evidence assembly.
4. Slice 2+ may execute bounded fusion into evidence candidates under the same
   fail-closed flags; never treat citation presence as claim verification
   (MAI-30).
5. GAP-P2-001 / GAP-P2-008 stay OPEN; GAP-P1-004 / GAP-P1-008 stay REDUCED.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Auto-run RRF on every chat | Ollama dependency / side effects |
| Authorize rerank in annotation | Wrong slice / authority |
| Claim hybrid production-eligible | GAP-P2-001 |
| Claim citations/claims verified | GAP-P2-008 / MAI-30 |

## Related

- `docs/mokxya-ai/MAI_29_HYBRID_FUSION_RERANKING_AND_EVIDENCE.md`
- `erp_bot/src/oip/modules/conversation/application/hybrid_fusion_service.py`
