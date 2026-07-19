"""MAI-28 slice 1 — vector index readiness annotation (no embed/query)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.contracts.vector_index import VectorIndexStatus
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.knowledge_source_governance_service import (
    attach_knowledge_source_governance_to_request,
)
from src.oip.modules.conversation.application.vector_index_service import (
    RUNTIME_VERSION,
    assert_vector_index_authority,
    attach_vector_index_to_request,
    build_vector_index_bundle,
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
    return attach_vector_index_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION.startswith("mai-28.")


def test_complete_not_production_eligible() -> None:
    req = _pipeline("show VAT report for this month")
    bundle = req.vector_index_bundle
    assert bundle is not None
    assert bundle.analysis_status == VectorIndexStatus.COMPLETE
    assert bundle.vector_backend == "CHROMA_OLLAMA"
    assert bundle.ollama_required is True
    assert bundle.production_eligible is False
    assert bundle.citations_verified is False
    assert bundle.embed_invocations == 0
    assert bundle.query_executions == 0
    assert bundle.documents_retrieved == 0
    assert bundle.is_execution_authority is False
    assert_vector_index_authority(bundle)


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.vector_index_bundle
    assert bundle is not None
    assert bundle.analysis_status == VectorIndexStatus.SKIP
    assert bundle.production_eligible is False
    assert bundle.embed_invocations == 0


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    vec = (dto.metadata or {}).get("vector_index") or {}
    assert vec.get("ollama_required") is True
    assert vec.get("production_eligible") is False
    assert vec.get("citations_verified") is False
    assert vec.get("is_execution_authority") is False
    assert vec.get("embed_invocations") == 0


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
    bundle = build_vector_index_bundle(req)
    assert bundle.analysis_status == VectorIndexStatus.SKIP


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai28"
        / "frozen"
        / "vector_index_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.vector_index_bundle
        assert bundle is not None
        assert bundle.production_eligible is False
        assert bundle.citations_verified is False
        assert bundle.embed_invocations == 0
        assert bundle.query_executions == 0
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_ollama_required") is not None:
            assert bundle.ollama_required is case["expected_ollama_required"]
