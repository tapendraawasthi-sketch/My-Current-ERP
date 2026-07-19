# MAI-29 — Hybrid Fusion, Reranking, and Evidence Bundles

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING`  
**Authority:** [ADR_0046](decisions/ADR_0046_HYBRID_FUSION_AUTHORITY.md)  
**Runtime:** `mai-29.0.2-slice2` (engineering; not production-approved)

## Objective

Annotate hybrid fusion / evidence policy, then assemble unverified evidence
*candidates* (lexical-only or optional RRF) — without authorizing rerank or
claiming citation/claim verification.

## Slice 1

1. Ingress `HYBRID_FUSION_*` after VECTOR_INDEX
2. `HybridFusionBundleV1` when knowledge-source governance is COMPLETE
3. Lexical ready → `LEXICAL_ONLY`; + chroma → `RRF_CANDIDATE`
4. Annotation: `fusion_executed=false`; `evidence_assembled=false`

## Slice 2

1. Consume helpers assemble evidence candidates (separate from annotation bundle)
2. Default → `LEXICAL_ONLY` candidates from lexical citations
3. `RRF_CANDIDATE` + non-prod allow → `RRF_APPLIED` (rrf_k=60)
4. Prod-eligible / rerank / verified claims → BLOCKED
5. Forward `hybrid_fusion` into grounding; `claims_verified=false`

## Gates

| Case | Expect |
|------|--------|
| Default | LEXICAL_ONLY candidates; unverified |
| Allow + RRF_CANDIDATE | RRF_APPLIED order + candidates |
| Authority flags | BLOCKED |
| Annotation bundle | still fusion_executed=false |

## Non-goals

- Production hybrid requiring Ollama
- Claim-citation verification (MAI-30)
- Closing GAP-P2-001 / GAP-P2-008
- Production approval
