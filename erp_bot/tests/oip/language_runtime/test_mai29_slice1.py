"""MAI-29 slice 1 — hybrid fusion policy annotation (no RRF execute)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.hybrid_fusion import HybridFusionMode, HybridFusionStatus
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.hybrid_fusion_service import (
    RUNTIME_VERSION,
    assert_hybrid_fusion_authority,
    attach_hybrid_fusion_to_request,
    build_hybrid_fusion_bundle,
)
from src.oip.modules.conversation.application.knowledge_source_governance_service import (
    attach_knowledge_source_governance_to_request,
)
from src.oip.modules.conversation.application.lexical_index_service import (
    attach_lexical_index_to_request,
)
from src.oip.modules.conversation.application.vector_index_service import (
    attach_vector_index_to_request,
)


def _pipeline(text: str):
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text=text,
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
    )
    req = attach_router_decision_to_request(req)
    req = attach_knowledge_source_governance_to_request(req)
    req = attach_lexical_index_to_request(req)
    req = attach_vector_index_to_request(req)
    return attach_hybrid_fusion_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION.startswith("mai-29.")


def test_complete_without_executing_fusion() -> None:
    req = _pipeline("show VAT report for this month")
    bundle = req.hybrid_fusion_bundle
    assert bundle is not None
    assert bundle.analysis_status == HybridFusionStatus.COMPLETE
    assert bundle.fusion_mode in {
        HybridFusionMode.LEXICAL_ONLY,
        HybridFusionMode.RRF_CANDIDATE,
    }
    assert bundle.rrf_k == 60
    assert bundle.fusion_executed is False
    assert bundle.rerank_authorized is False
    assert bundle.evidence_assembled is False
    assert bundle.evidence_item_count == 0
    assert bundle.claims_verified is False
    assert bundle.citations_verified is False
    assert bundle.hybrid_production_eligible is False
    assert bundle.lexical_authoritative is True
    assert bundle.is_execution_authority is False
    assert_hybrid_fusion_authority(bundle)
    # Local checkout has chroma → expect RRF_CANDIDATE when lexical ready.
    if (
        req.lexical_index_bundle
        and req.lexical_index_bundle.fts_ready
        and req.vector_index_bundle
        and req.vector_index_bundle.chroma_present
    ):
        assert bundle.fusion_mode == HybridFusionMode.RRF_CANDIDATE


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.hybrid_fusion_bundle
    assert bundle is not None
    assert bundle.analysis_status == HybridFusionStatus.SKIP
    assert bundle.fusion_mode == HybridFusionMode.SKIP
    assert bundle.fusion_executed is False


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    hyb = (dto.metadata or {}).get("hybrid_fusion") or {}
    assert hyb.get("fusion_executed") is False
    assert hyb.get("rerank_authorized") is False
    assert hyb.get("hybrid_production_eligible") is False
    assert hyb.get("claims_verified") is False
    assert hyb.get("is_execution_authority") is False


def test_build_without_governance_skips() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="show balance",
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
    )
    bundle = build_hybrid_fusion_bundle(req)
    assert bundle.analysis_status == HybridFusionStatus.SKIP


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai29"
        / "frozen"
        / "hybrid_fusion_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.hybrid_fusion_bundle
        assert bundle is not None
        assert bundle.fusion_executed is False
        assert bundle.rerank_authorized is False
        assert bundle.hybrid_production_eligible is False
        assert bundle.claims_verified is False
        assert bundle.citations_verified is False
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_fusion_mode"):
            assert bundle.fusion_mode.value == case["expected_fusion_mode"], case[
                "case_id"
            ]
