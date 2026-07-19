"""MAI-29 — hybrid fusion / evidence policy + bounded consume.

Slice 1: recommend LEXICAL_ONLY or RRF_CANDIDATE from lexical/vector readiness.
Slice 2: assemble evidence *candidates* from citation lists (lexical-only or
optional RRF). Annotation bundle never claims execute/verify; consume metadata
is separate. Rerank stays unauthorized; claims/citations stay unverified.
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from ....contracts.hybrid_fusion import (
    HybridFusionBundleV1,
    HybridFusionMode,
    HybridFusionStatus,
)
from ....contracts.knowledge_source_governance import KnowledgeSourceGovernanceStatus
from ....contracts.lexical_index import LexicalIndexStatus
from ....contracts.request import CanonicalAIRequestV1
from ....contracts.vector_index import VectorIndexStatus

RUNTIME_VERSION = "mai-29.0.2-slice2"
AUTHORITY = "ADR_0046"
RRF_K_DEFAULT = 60
MAX_EVIDENCE_CANDIDATES = 8


def build_hybrid_fusion_bundle(
    request: CanonicalAIRequestV1,
) -> HybridFusionBundleV1:
    gov = request.knowledge_source_governance_bundle
    if gov is None:
        return HybridFusionBundleV1(
            analysis_status=HybridFusionStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            fusion_mode=HybridFusionMode.SKIP,
            reason_codes=("NO_GOVERNANCE",),
            warnings=("NO_GOVERNANCE",),
        )

    if gov.analysis_status != KnowledgeSourceGovernanceStatus.COMPLETE:
        return HybridFusionBundleV1(
            analysis_status=HybridFusionStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            fusion_mode=HybridFusionMode.SKIP,
            reason_codes=("GOVERNANCE_NOT_COMPLETE",),
            warnings=("GOVERNANCE_NOT_COMPLETE",),
        )

    lex = request.lexical_index_bundle
    vec = request.vector_index_bundle

    reasons: list[str] = [
        "GOVERNANCE_COMPLETE",
        "RRF_K_60",
        "RERANK_NOT_AUTHORIZED",
        "ANNOTATION_DOES_NOT_EXECUTE_FUSION",
        "CLAIMS_NOT_VERIFIED",
        "CITATIONS_NOT_VERIFIED",
        "HYBRID_NOT_PRODUCTION_ELIGIBLE",
        "LEXICAL_AUTHORITATIVE",
    ]
    warnings: list[str] = ["PROD_PATH_USES_LEXICAL_ONLY"]

    fusion_mode = HybridFusionMode.LEXICAL_ONLY
    lex_ready = (
        lex is not None
        and lex.analysis_status == LexicalIndexStatus.COMPLETE
        and lex.fts_ready
        and lex.index_present
    )
    vec_chroma = (
        vec is not None
        and vec.analysis_status == VectorIndexStatus.COMPLETE
        and vec.chroma_present
        and vec.index_present
    )

    if not lex_ready:
        reasons.append("LEXICAL_NOT_READY")
        warnings.append("LEXICAL_NOT_READY")
        fusion_mode = HybridFusionMode.SKIP
    else:
        reasons.append("LEXICAL_READY")

    if vec_chroma and lex_ready:
        fusion_mode = HybridFusionMode.RRF_CANDIDATE
        reasons.append("RRF_CANDIDATE_CHROMA_PRESENT")
        warnings.append("RRF_REQUIRES_NON_PROD_ALLOW_FLAGS")
    elif lex_ready:
        reasons.append("LEXICAL_ONLY_RECOMMENDED")

    return HybridFusionBundleV1(
        analysis_status=HybridFusionStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        fusion_mode=fusion_mode,
        rrf_k=RRF_K_DEFAULT,
        lexical_authoritative=True,
        rerank_authorized=False,
        fusion_executed=False,
        evidence_assembled=False,
        evidence_item_count=0,
        claims_verified=False,
        citations_verified=False,
        ollama_required_for_hybrid=True,
        hybrid_production_eligible=False,
        reason_codes=tuple(reasons),
        warnings=tuple(warnings),
        documents_retrieved=0,
        index_mutations=0,
    )


def attach_hybrid_fusion_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_hybrid_fusion_bundle(request)
    return request.model_copy(update={"hybrid_fusion_bundle": bundle})


def assert_hybrid_fusion_authority(
    bundle: HybridFusionBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.rerank_authorized
        or bundle.fusion_executed
        or bundle.evidence_assembled
        or bundle.claims_verified
        or bundle.citations_verified
        or bundle.hybrid_production_eligible
        or bundle.evidence_item_count != 0
        or bundle.documents_retrieved != 0
        or bundle.index_mutations != 0
    ):
        raise RuntimeError("HYBRID_FUSION_AUTHORITY")


def hybrid_fusion_to_metadata(
    bundle: HybridFusionBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "fusion_mode": bundle.fusion_mode.value,
        "rrf_k": bundle.rrf_k,
        "lexical_authoritative": True,
        "rerank_authorized": False,
        "fusion_executed": False,
        "evidence_assembled": False,
        "evidence_item_count": 0,
        "claims_verified": False,
        "citations_verified": False,
        "ollama_required_for_hybrid": True,
        "hybrid_production_eligible": False,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }


def _as_hybrid_meta(
    hybrid_fusion: Mapping[str, Any] | HybridFusionBundleV1 | None,
) -> dict[str, Any] | None:
    if hybrid_fusion is None:
        return None
    if isinstance(hybrid_fusion, HybridFusionBundleV1):
        return hybrid_fusion_to_metadata(hybrid_fusion)
    if isinstance(hybrid_fusion, Mapping):
        return dict(hybrid_fusion)
    return None


def _authority_blocks_consume(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("rerank_authorized") is True
        or data.get("claims_verified") is True
        or data.get("citations_verified") is True
        or data.get("hybrid_production_eligible") is True
    )


def should_apply_rrf_fusion(
    hybrid_fusion: Mapping[str, Any] | HybridFusionBundleV1 | None,
    *,
    allow_non_prod_semantic: bool,
) -> bool:
    """RRF only for RRF_CANDIDATE + explicit non-prod allow; never when flags lie."""
    data = _as_hybrid_meta(hybrid_fusion)
    if data is None:
        return False
    if _authority_blocks_consume(data):
        return False
    if str(data.get("analysis_status") or "") != HybridFusionStatus.COMPLETE.value:
        return False
    if str(data.get("fusion_mode") or "") != HybridFusionMode.RRF_CANDIDATE.value:
        return False
    return bool(allow_non_prod_semantic)


def resolve_fusion_consume_mode(
    hybrid_fusion: Mapping[str, Any] | HybridFusionBundleV1 | None,
    *,
    allow_non_prod_semantic: bool = False,
) -> str:
    data = _as_hybrid_meta(hybrid_fusion)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks_consume(data):
        return "BLOCKED"
    if str(data.get("analysis_status") or "") != HybridFusionStatus.COMPLETE.value:
        return "SKIP"
    if should_apply_rrf_fusion(
        data, allow_non_prod_semantic=allow_non_prod_semantic
    ):
        return "RRF_APPLIED"
    mode = str(data.get("fusion_mode") or "")
    if mode == HybridFusionMode.SKIP.value:
        return "SKIP"
    return "LEXICAL_ONLY"


def rrf_fuse_record_ids(
    lexical_ids: Sequence[str],
    semantic_ids: Sequence[str],
    *,
    rrf_k: int = RRF_K_DEFAULT,
    top_k: int = MAX_EVIDENCE_CANDIDATES,
) -> list[tuple[str, float]]:
    """Reciprocal-rank fusion over record ids; lexical + semantic legs."""
    scores: dict[str, float] = {}
    for rank, rid in enumerate(lexical_ids):
        if not rid:
            continue
        scores[rid] = scores.get(rid, 0.0) + 1.0 / (rrf_k + rank + 1)
    for rank, rid in enumerate(semantic_ids):
        if not rid:
            continue
        scores[rid] = scores.get(rid, 0.0) + 1.0 / (rrf_k + rank + 1)
    ordered = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    return ordered[:top_k]


def assemble_evidence_candidates(
    citations: Sequence[Any],
    *,
    fusion_consume_mode: str,
    rrf_k: int = RRF_K_DEFAULT,
    lexical_ids: Sequence[str] | None = None,
    semantic_ids: Sequence[str] | None = None,
    top_k: int = MAX_EVIDENCE_CANDIDATES,
) -> list[dict[str, Any]]:
    """Build unverified evidence *candidates* (not EvidenceItemV1 / not claims)."""
    by_id: dict[str, Any] = {}
    for c in citations:
        rid = str(getattr(c, "record_id", None) or "")
        if not rid:
            continue
        by_id[rid] = c

    if fusion_consume_mode == "RRF_APPLIED":
        ranked = rrf_fuse_record_ids(
            lexical_ids or [str(getattr(c, "record_id", "") or "") for c in citations],
            semantic_ids or (),
            rrf_k=rrf_k,
            top_k=top_k,
        )
    elif fusion_consume_mode in {"LEXICAL_ONLY", "UNCHANGED"}:
        ranked = [
            (str(getattr(c, "record_id", "") or ""), 0.0)
            for c in citations
            if getattr(c, "record_id", None)
        ][:top_k]
    else:
        return []

    lex_set = set(lexical_ids or ())
    sem_set = set(semantic_ids or ())
    out: list[dict[str, Any]] = []
    for i, (rid, score) in enumerate(ranked):
        c = by_id.get(rid)
        if c is None:
            continue
        if rid in lex_set and rid in sem_set:
            leg = "both"
        elif rid in sem_set:
            leg = "semantic"
        else:
            leg = "lexical"
        content = str(getattr(c, "content", "") or "")
        out.append(
            {
                "evidence_candidate_id": f"ec-{i + 1:04d}",
                "source_record_id": rid,
                "retrieval_collection": getattr(c, "retrieval_collection", None),
                "domain": getattr(c, "domain", None),
                "snippet": content[:240],
                "fusion_rank": i + 1,
                "rrf_score": round(float(score), 6) if score else None,
                "source_leg": leg,
                "claims_verified": False,
                "citations_verified": False,
                "is_execution_authority": False,
            }
        )
    return out


def fuse_citations_for_consume(
    lexical: Sequence[Any],
    semantic: Sequence[Any],
    *,
    hybrid_fusion: Mapping[str, Any] | HybridFusionBundleV1 | None,
    allow_non_prod_semantic: bool = False,
    top_k: int = MAX_EVIDENCE_CANDIDATES,
) -> tuple[list[Any], list[dict[str, Any]], dict[str, Any]]:
    """Return (ordered citations, evidence candidates, consume observability)."""
    mode = resolve_fusion_consume_mode(
        hybrid_fusion,
        allow_non_prod_semantic=allow_non_prod_semantic,
    )
    data = _as_hybrid_meta(hybrid_fusion) or {}
    rrf_k = int(data.get("rrf_k") or RRF_K_DEFAULT)
    lex_ids = [str(getattr(c, "record_id", "") or "") for c in lexical]
    sem_ids = [str(getattr(c, "record_id", "") or "") for c in semantic]

    if mode == "BLOCKED" or mode == "SKIP":
        return [], [], {
            "fusion_consume_mode": mode,
            "evidence_candidate_count": 0,
            "rerank_authorized": False,
            "claims_verified": False,
            "citations_verified": False,
            "hybrid_production_eligible": False,
            "lexical_authoritative": True,
            "is_execution_authority": False,
        }

    if mode == "RRF_APPLIED" and semantic:
        ranked_ids = [
            rid
            for rid, _ in rrf_fuse_record_ids(
                lex_ids, sem_ids, rrf_k=rrf_k, top_k=top_k
            )
        ]
        by_id: dict[str, Any] = {}
        for c in list(lexical) + list(semantic):
            rid = str(getattr(c, "record_id", "") or "")
            if rid and rid not in by_id:
                by_id[rid] = c
        ordered = [by_id[i] for i in ranked_ids if i in by_id]
    else:
        # Lexical authoritative: lexical first, semantic filler without RRF.
        ordered = list(lexical)
        seen = {str(getattr(c, "record_id", "") or "") for c in ordered}
        for c in semantic:
            rid = str(getattr(c, "record_id", "") or "")
            if rid and rid not in seen:
                ordered.append(c)
                seen.add(rid)
        ordered = ordered[:top_k]
        mode = "LEXICAL_ONLY"

    candidates = assemble_evidence_candidates(
        ordered,
        fusion_consume_mode=mode,
        rrf_k=rrf_k,
        lexical_ids=lex_ids,
        semantic_ids=sem_ids,
        top_k=top_k,
    )
    obs = {
        "fusion_consume_mode": mode,
        "evidence_candidate_count": len(candidates),
        "rrf_k": rrf_k,
        "rerank_authorized": False,
        "claims_verified": False,
        "citations_verified": False,
        "hybrid_production_eligible": False,
        "lexical_authoritative": True,
        "is_execution_authority": False,
        "annotation_fusion_executed": False,
        "annotation_evidence_assembled": False,
    }
    return ordered, candidates, obs
