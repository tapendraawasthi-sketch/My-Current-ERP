# MAI-29 — Hybrid Fusion, Reranking, and Evidence Bundles

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0046](decisions/ADR_0046_HYBRID_FUSION_AUTHORITY.md)  
**Runtime:** `mai-29.0.1-slice1` (engineering; not production-approved)

## Objective

Annotate hybrid fusion / evidence policy (LEXICAL_ONLY vs RRF_CANDIDATE) —
without executing RRF, authorizing rerank, or claiming citation/claim
verification.

## Slice 1

1. Ingress `HYBRID_FUSION_*` after VECTOR_INDEX
2. `HybridFusionBundleV1` when knowledge-source governance is COMPLETE
3. Lexical ready → `LEXICAL_ONLY`; + chroma → `RRF_CANDIDATE`
4. `rrf_k=60`; `rerank_authorized=false`; `fusion_executed=false`
5. `evidence_assembled=false`; `claims_verified=false`
6. `hybrid_production_eligible=false`; `lexical_authoritative=true`

## Slice 2 (planned)

Bounded RRF/evidence candidate assembly under fail-closed flags; still no
claim verification (MAI-30).

## Gates

| Case | Expect |
|------|--------|
| COMPLETE + lexical ready | COMPLETE; LEXICAL_ONLY or RRF_CANDIDATE |
| Chroma present | RRF_CANDIDATE (not executed) |
| OOD / SKIP | SKIP |
| Any bundle | no fusion execute; no rerank; unverified |

## Non-goals

- Production hybrid requiring Ollama
- Claim-citation verification (MAI-30)
- Closing GAP-P2-001 / GAP-P2-008
- Production approval
