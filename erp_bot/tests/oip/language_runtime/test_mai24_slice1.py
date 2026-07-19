"""MAI-24 slice 1 — knowledge source governance annotation (no retrieval)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.knowledge_source_governance import (
    KnowledgeSourceGovernanceStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.knowledge_source_governance_service import (
    RUNTIME_VERSION,
    assert_knowledge_source_governance_authority,
    attach_knowledge_source_governance_to_request,
    build_knowledge_source_governance_bundle,
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
    return attach_knowledge_source_governance_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-24.0.1-slice1"


def test_complete_purchase_allows_accounting() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.knowledge_source_governance_bundle
    assert bundle is not None
    assert bundle.analysis_status == KnowledgeSourceGovernanceStatus.COMPLETE
    assert "accounting_and_erp" in bundle.allowed_retrieval_collections
    assert "evaluation_only" in bundle.blocked_retrieval_collections
    assert "evaluation_only" not in bundle.allowed_retrieval_collections
    assert bundle.allow_evaluation_corpus is False
    assert bundle.documents_retrieved == 0
    assert bundle.is_execution_authority is False
    assert_knowledge_source_governance_authority(bundle)


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.knowledge_source_governance_bundle
    assert bundle is not None
    assert bundle.analysis_status == KnowledgeSourceGovernanceStatus.SKIP
    assert bundle.allowed_retrieval_collections == ()
    assert "evaluation_only" in bundle.blocked_retrieval_collections


def test_report_complete() -> None:
    req = _pipeline("show balance sheet")
    bundle = req.knowledge_source_governance_bundle
    assert bundle is not None
    assert bundle.analysis_status == KnowledgeSourceGovernanceStatus.COMPLETE
    assert "accounting_and_erp" in bundle.allowed_retrieval_collections


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    ksg = (dto.metadata or {}).get("knowledge_source_governance") or {}
    assert ksg.get("is_execution_authority") is False
    assert ksg.get("documents_retrieved") == 0
    assert ksg.get("allow_evaluation_corpus") is False
    assert ksg.get("analysis_status") == "COMPLETE"


def test_build_without_router_skips() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="hello",
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
    bundle = build_knowledge_source_governance_bundle(req)
    assert bundle.analysis_status == KnowledgeSourceGovernanceStatus.SKIP


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai24"
        / "frozen"
        / "knowledge_source_governance_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.knowledge_source_governance_bundle
        assert bundle is not None
        assert bundle.documents_retrieved == 0
        assert bundle.allow_evaluation_corpus is False
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_blocks_evaluation"):
            assert "evaluation_only" in bundle.blocked_retrieval_collections
            assert "evaluation_only" not in bundle.allowed_retrieval_collections
        if case.get("expected_has_accounting") and (
            bundle.analysis_status == KnowledgeSourceGovernanceStatus.COMPLETE
        ):
            assert "accounting_and_erp" in bundle.allowed_retrieval_collections, case[
                "case_id"
            ]
