"""MAI-40 slice 1 — financial close / adjustment assistance (never posts)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.financial_close_adjustment_assistance import (
    CloseAssistReadiness,
    FinancialCloseAdjustmentAssistanceStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.claim_citation_service import (
    attach_claim_citation_to_request,
)
from src.oip.modules.conversation.application.financial_close_adjustment_assistance_service import (
    RUNTIME_VERSION,
    assert_financial_close_adjustment_assistance_authority,
    attach_financial_close_adjustment_assistance_to_request,
    build_financial_close_adjustment_assistance_bundle,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.hybrid_fusion_service import (
    attach_hybrid_fusion_to_request,
)
from src.oip.modules.conversation.application.knowledge_source_governance_service import (
    attach_knowledge_source_governance_to_request,
)
from src.oip.modules.conversation.application.legal_question_research_service import (
    attach_legal_question_research_to_request,
)
from src.oip.modules.conversation.application.lexical_index_service import (
    attach_lexical_index_to_request,
)
from src.oip.modules.conversation.application.nfrs_nas_policy_disclosure_pilot_service import (
    attach_nfrs_nas_policy_disclosure_pilot_to_request,
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
    req = attach_hybrid_fusion_to_request(req)
    req = attach_claim_citation_to_request(req)
    req = attach_legal_question_research_to_request(req)
    req = attach_nfrs_nas_policy_disclosure_pilot_to_request(req)
    return attach_financial_close_adjustment_assistance_to_request(req)


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-40.")


def test_close_policy_declared() -> None:
    req = _pipeline(
        "map expense accounts for financial close adjustments under NFRS"
    )
    bundle = req.financial_close_adjustment_assistance_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status
        == FinancialCloseAdjustmentAssistanceStatus.COMPLETE
    )
    assert bundle.close_assist_readiness == CloseAssistReadiness.POLICY_DECLARED
    assert "FINANCIAL_CLOSE" in bundle.in_scope_topics
    assert "ADJUSTMENT" in bundle.in_scope_topics
    assert bundle.pilot_scope == "FINANCIAL_CLOSE_ADJUSTMENT_ONLY"
    assert bundle.adjustment_status == "CANDIDATE_ASSISTANCE_ONLY"
    assert bundle.nfrs_nas_bound is True
    assert bundle.close_posted is False
    assert bundle.adjustments_posted is False
    assert bundle.books_locked is False
    assert bundle.period_closed is False
    assert bundle.legal_effective_dates_proven is False
    assert bundle.specialist_signoff_status == "NOT_SIGNED"
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.is_execution_authority is False
    assert "PILOT_SCOPE_FINANCIAL_CLOSE_ADJUSTMENT_ONLY" in bundle.reason_codes
    assert_financial_close_adjustment_assistance_authority(bundle)


def test_checklist_topic() -> None:
    req = _pipeline(
        "help prepare month-end financial close checklist under NFRS"
    )
    bundle = req.financial_close_adjustment_assistance_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status
        == FinancialCloseAdjustmentAssistanceStatus.COMPLETE
    )
    assert "CHECKLIST" in bundle.in_scope_topics
    assert "FINANCIAL_CLOSE" in bundle.in_scope_topics


def test_nfrs_only_skips() -> None:
    # NFRS mapping without close/adjustment cues → skip close-assist.
    req = _pipeline(
        "map expense accounts to NAS for financial statements under NFRS"
    )
    bundle = req.financial_close_adjustment_assistance_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == FinancialCloseAdjustmentAssistanceStatus.SKIP
    )
    assert bundle.close_posted is False


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.financial_close_adjustment_assistance_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == FinancialCloseAdjustmentAssistanceStatus.SKIP
    )


def test_no_nfrs_skips() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="map expense accounts for financial close adjustments under NFRS",
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
    bundle = build_financial_close_adjustment_assistance_bundle(req)
    assert (
        bundle.analysis_status == FinancialCloseAdjustmentAssistanceStatus.SKIP
    )
    assert "NO_NFRS_NAS_PILOT" in bundle.reason_codes


def test_adapter_metadata() -> None:
    req = _pipeline(
        "map expense accounts for financial close adjustments under NFRS"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("financial_close_adjustment_assistance") or {}
    assert meta.get("close_posted") is False
    assert meta.get("adjustments_posted") is False
    assert meta.get("books_locked") is False
    assert meta.get("period_closed") is False
    assert meta.get("adjustment_status") == "CANDIDATE_ASSISTANCE_ONLY"
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("is_execution_authority") is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai40"
        / "frozen"
        / "financial_close_adjustment_assistance_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.financial_close_adjustment_assistance_bundle
        assert bundle is not None
        assert bundle.close_posted is False
        assert bundle.adjustments_posted is False
        assert bundle.books_locked is False
        assert bundle.period_closed is False
        assert bundle.legal_effective_dates_proven is False
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.close_assist_readiness.value == case["expected_readiness"]
            ), case["case_id"]
        if case.get("expected_topic"):
            assert case["expected_topic"] in bundle.in_scope_topics, case[
                "case_id"
            ]
