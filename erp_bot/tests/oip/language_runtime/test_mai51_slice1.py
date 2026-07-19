"""MAI-51 slice 1 — private user-document intelligence (never ingests docs)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.private_user_document_intelligence import (
    PrivateUserDocumentIntelligenceReadiness,
    PrivateUserDocumentIntelligenceStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.private_user_document_intelligence_service import (
    RUNTIME_VERSION,
    assert_private_user_document_intelligence_authority,
    attach_private_user_document_intelligence_to_request,
    build_private_user_document_intelligence_bundle,
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
    return attach_private_user_document_intelligence_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION.startswith("mai-51.")


def test_private_document_policy_declared() -> None:
    req = _pipeline(
        "private document intelligence with user upload and document Q&A"
    )
    bundle = req.private_user_document_intelligence_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status
        == PrivateUserDocumentIntelligenceStatus.COMPLETE
    )
    assert (
        bundle.private_user_document_intelligence_readiness
        == PrivateUserDocumentIntelligenceReadiness.POLICY_DECLARED
    )
    assert "PRIVATE_DOCUMENT" in bundle.in_scope_topics
    assert "USER_UPLOAD" in bundle.in_scope_topics
    assert "DOCUMENT_QA" in bundle.in_scope_topics
    assert (
        bundle.pilot_scope
        == "PRIVATE_USER_DOCUMENT_INTELLIGENCE_CANDIDATE_ONLY"
    )
    assert bundle.release_status == "NOT_RELEASED"
    assert bundle.private_document_intelligence_enabled is False
    assert bundle.document_ingested is False
    assert bundle.document_indexed is False
    assert bundle.document_qa_live is False
    assert bundle.retention_policy_applied is False
    assert bundle.access_control_enforced is False
    assert bundle.cross_tenant_isolation_proven is False
    assert bundle.user_document_released is False
    assert bundle.production_approved is False
    assert bundle.documents_retrieved == 0
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.is_execution_authority is False
    assert (
        "PILOT_SCOPE_PRIVATE_USER_DOCUMENT_INTELLIGENCE_CANDIDATE_ONLY"
        in bundle.reason_codes
    )
    assert "DOCUMENT_NOT_INGESTED" in bundle.reason_codes
    assert_private_user_document_intelligence_authority(bundle)


def test_summary_retention_access() -> None:
    req = _pipeline(
        "document summary with retention policy and document access control"
    )
    bundle = req.private_user_document_intelligence_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status
        == PrivateUserDocumentIntelligenceStatus.COMPLETE
    )
    assert "DOCUMENT_SUMMARY" in bundle.in_scope_topics
    assert "RETENTION_POLICY" in bundle.in_scope_topics
    assert "ACCESS_CONTROL" in bundle.in_scope_topics
    assert bundle.document_ingested is False
    assert bundle.document_qa_live is False


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.private_user_document_intelligence_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == PrivateUserDocumentIntelligenceStatus.SKIP
    )


def test_speech_without_document_skips() -> None:
    req = _pipeline(
        "Nepali speech and English speech with speech-to-text and text-to-speech"
    )
    bundle = req.private_user_document_intelligence_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == PrivateUserDocumentIntelligenceStatus.SKIP
    )


def test_adapter_metadata() -> None:
    req = _pipeline(
        "private document intelligence with user upload and document Q&A"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("private_user_document_intelligence") or {}
    assert meta.get("private_document_intelligence_enabled") is False
    assert meta.get("document_ingested") is False
    assert meta.get("document_qa_live") is False
    assert meta.get("cross_tenant_isolation_proven") is False
    assert meta.get("production_approved") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("is_execution_authority") is False


def test_build_direct() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="extract from my document with document upload",
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
    bundle = build_private_user_document_intelligence_bundle(req)
    assert (
        bundle.analysis_status
        == PrivateUserDocumentIntelligenceStatus.COMPLETE
    )
    assert "DOCUMENT_EXTRACTION" in bundle.in_scope_topics
    assert "USER_UPLOAD" in bundle.in_scope_topics
    assert bundle.document_ingested is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai51"
        / "frozen"
        / "private_user_document_intelligence_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.private_user_document_intelligence_bundle
        assert bundle is not None
        assert bundle.private_document_intelligence_enabled is False
        assert bundle.document_ingested is False
        assert bundle.document_qa_live is False
        assert bundle.documents_retrieved == 0
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.private_user_document_intelligence_readiness.value
                == case["expected_readiness"]
            ), case["case_id"]
        if case.get("expected_topic"):
            assert case["expected_topic"] in bundle.in_scope_topics, case[
                "case_id"
            ]
