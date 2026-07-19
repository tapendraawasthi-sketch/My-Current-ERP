"""MAI-36 slice 1 — legal question framer / research mode (never mutates)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.legal_question_research import (
    EscalationPolicy,
    LegalQuestionResearchStatus,
    LegalRiskClass,
    ResearchModeReadiness,
    SlotStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.claim_citation_service import (
    attach_claim_citation_to_request,
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
    RUNTIME_VERSION,
    assert_legal_question_research_authority,
    attach_legal_question_research_to_request,
    build_legal_question_research_bundle,
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
    req = attach_hybrid_fusion_to_request(req)
    req = attach_claim_citation_to_request(req)
    return attach_legal_question_research_to_request(req)


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-36.")


def test_legal_tax_clarify_missing_jurisdiction() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    bundle = req.legal_question_research_bundle
    assert bundle is not None
    assert bundle.analysis_status == LegalQuestionResearchStatus.COMPLETE
    assert bundle.research_mode_active is True
    assert bundle.research_mode_readiness == ResearchModeReadiness.CLARIFY_REQUIRED
    assert bundle.jurisdiction_status == SlotStatus.MISSING
    assert bundle.as_of_status == SlotStatus.PRESENT
    assert bundle.risk_class == LegalRiskClass.HIGH
    assert bundle.escalation_policy == (
        EscalationPolicy.PROFESSIONAL_REVIEW_RECOMMENDED
    )
    assert bundle.mutation_tools_allowed is False
    assert bundle.current_law_definitive is False
    assert bundle.legal_effective_dates_proven is False
    assert bundle.legal_proof_claimed is False
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.research_planner_executed is False
    assert bundle.is_execution_authority is False
    assert "LEGAL_TAX_CUE_PRESENT" in bundle.reason_codes
    assert_legal_question_research_authority(bundle)


def test_legal_tax_policy_declared_when_slots_present() -> None:
    req = _pipeline("show current VAT rate in Nepal under VAT Act as of 2024")
    bundle = req.legal_question_research_bundle
    assert bundle is not None
    assert bundle.analysis_status == LegalQuestionResearchStatus.COMPLETE
    assert bundle.research_mode_readiness == ResearchModeReadiness.POLICY_DECLARED
    assert bundle.jurisdiction_status == SlotStatus.PRESENT
    assert bundle.as_of_status == SlotStatus.PRESENT
    assert bundle.jurisdiction_candidate is not None
    assert bundle.current_law_definitive is False
    assert bundle.gap_p2_008_status == "OPEN"


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.legal_question_research_bundle
    assert bundle is not None
    assert bundle.analysis_status == LegalQuestionResearchStatus.SKIP
    assert bundle.research_mode_active is False
    assert bundle.mutation_tools_allowed is False


def test_report_skips() -> None:
    req = _pipeline("show balance sheet")
    bundle = req.legal_question_research_bundle
    assert bundle is not None
    assert bundle.analysis_status == LegalQuestionResearchStatus.SKIP


def test_no_claim_skips() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="show VAT rate under VAT Act",
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
    bundle = build_legal_question_research_bundle(req)
    assert bundle.analysis_status == LegalQuestionResearchStatus.SKIP
    assert "NO_CLAIM_CITATION" in bundle.reason_codes


def test_adapter_metadata() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    lqr = (dto.metadata or {}).get("legal_question_research") or {}
    assert lqr.get("mutation_tools_allowed") is False
    assert lqr.get("current_law_definitive") is False
    assert lqr.get("legal_effective_dates_proven") is False
    assert lqr.get("legal_proof_claimed") is False
    assert lqr.get("gap_p2_008_status") == "OPEN"
    assert lqr.get("is_execution_authority") is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai36"
        / "frozen"
        / "legal_question_research_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.legal_question_research_bundle
        assert bundle is not None
        assert bundle.mutation_tools_allowed is False
        assert bundle.current_law_definitive is False
        assert bundle.legal_effective_dates_proven is False
        assert bundle.legal_proof_claimed is False
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.research_mode_readiness.value == case["expected_readiness"]
            ), case["case_id"]
