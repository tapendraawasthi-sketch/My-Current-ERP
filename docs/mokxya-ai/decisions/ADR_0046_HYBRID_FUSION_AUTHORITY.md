# ADR_0046 — Hybrid Fusion / Evidence Authority

- **Status:** Accepted (2026-07-19); slice 2 addendum (2026-07-19)
- **Phase:** MAI-29-HYBRID-FUSION-RERANKING-EVIDENCE (slice 2)
- **Extends:** ADR_0001, ADR_0044, ADR_0045

## Context

MAI-27/28 made lexical FTS production-safe and gated Chroma/Ollama semantic as
non-prod. MAI-29 annotates fusion policy and assembles unverified evidence
candidates without claiming verification.

## Decision

1. MAI-29 owns `HybridFusionBundleV1` on `CanonicalAIRequestV1` after
   VECTOR_INDEX.
2. Slice 1: recommend `LEXICAL_ONLY` or `RRF_CANDIDATE`; annotation counters
   stay zero; `rerank_authorized=false`; `hybrid_production_eligible=false`.
3. **Slice 2:** consume (outside annotation bundle) builds evidence candidates:
   default `LEXICAL_ONLY`; `RRF_CANDIDATE` + non-prod allow → `RRF_APPLIED`
   (`rrf_k=60`). False prod/rerank/verified flags → BLOCKED. Annotation
   `fusion_executed` / `evidence_assembled` remain false.
4. Never treat candidates as verified claims/citations (MAI-30).
5. GAP-P2-001 / GAP-P2-008 stay OPEN; GAP-P1-004 / GAP-P1-008 stay REDUCED.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Auto-run RRF on every chat | Ollama dependency / side effects |
| Mutate annotation bundle execute flags | False authority on request contract |
| Authorize rerank | Wrong authority |
| Claim hybrid production-eligible | GAP-P2-001 |
| Claim citations/claims verified | GAP-P2-008 / MAI-30 |

## Related

- `docs/mokxya-ai/MAI_29_HYBRID_FUSION_RERANKING_AND_EVIDENCE.md`
- `erp_bot/src/oip/modules/conversation/application/hybrid_fusion_service.py`
