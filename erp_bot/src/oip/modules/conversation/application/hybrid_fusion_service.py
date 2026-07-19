"""MAI-29 — hybrid fusion / evidence policy annotation.

Slice 1: recommend LEXICAL_ONLY or RRF_CANDIDATE from lexical/vector readiness.
Never executes RRF, reranks, assembles evidence items, or claims verification.
"""

from __future__ import annotations

from typing import Any

from ....contracts.hybrid_fusion import (
    HybridFusionBundleV1,
    HybridFusionMode,
    HybridFusionStatus,
)
from ....contracts.knowledge_source_governance import KnowledgeSourceGovernanceStatus
from ....contracts.lexical_index import LexicalIndexStatus
from ....contracts.request import CanonicalAIRequestV1
from ....contracts.vector_index import VectorIndexStatus

RUNTIME_VERSION = "mai-29.0.1-slice1"
AUTHORITY = "ADR_0046"
RRF_K_DEFAULT = 60


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
        "FUSION_NOT_EXECUTED",
        "EVIDENCE_NOT_ASSEMBLED",
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
        # Candidate only — still requires dual non-prod flags at consume time.
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
