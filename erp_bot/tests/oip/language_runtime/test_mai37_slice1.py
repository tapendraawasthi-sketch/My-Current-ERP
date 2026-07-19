"""MAI-37 slice 1 — core Nepal tax knowledge pilot (never calculates)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.core_nepal_tax_knowledge_pilot import (
    CoreNepalTaxKnowledgePilotStatus,
    TaxPilotReadiness,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.claim_citation_service import (
    attach_claim_citation_to_request,
)
from src.oip.modules.conversation.application.core_nepal_tax_knowledge_pilot_service import (
    RUNTIME_VERSION,
    assert_core_nepal_tax_knowledge_pilot_authority,
    attach_core_nepal_tax_knowledge_pilot_to_request,
    build_core_nepal_tax_knowledge_pilot_bundle,
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
    return attach_core_nepal_tax_knowledge_pilot_to_request(req)


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-37.")


def test_vat_policy_declared() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    bundle = req.core_nepal_tax_knowledge_pilot_bundle
    assert bundle is not None
    assert bundle.analysis_status == CoreNepalTaxKnowledgePilotStatus.COMPLETE
    assert bundle.tax_pilot_readiness == TaxPilotReadiness.POLICY_DECLARED
    assert "VAT" in bundle.in_scope_topics
    assert bundle.pilot_scope == "INCOME_TAX_VAT_TDS_ONLY"
    assert bundle.research_mode_bound is True
    assert bundle.tax_calculator_invoked is False
    assert bundle.rate_lookup_executed is False
    assert bundle.current_law_definitive is False
    assert bundle.legal_effective_dates_proven is False
    assert bundle.specialist_signoff_status == "NOT_SIGNED"
    assert bundle.gold_questions_status == "NOT_RELEASED"
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.documents_retrieved == 0
    assert bundle.is_execution_authority is False
    assert "PILOT_SCOPE_INCOME_TAX_VAT_TDS_ONLY" in bundle.reason_codes
    assert_core_nepal_tax_knowledge_pilot_authority(bundle)


def test_tds_topic() -> None:
    req = _pipeline("show VAT and TDS rate under VAT Act")
    bundle = req.core_nepal_tax_knowledge_pilot_bundle
    assert bundle is not None
    assert bundle.analysis_status == CoreNepalTaxKnowledgePilotStatus.COMPLETE
    assert "TDS" in bundle.in_scope_topics
    assert "VAT" in bundle.in_scope_topics


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.core_nepal_tax_knowledge_pilot_bundle
    assert bundle is not None
    assert bundle.analysis_status == CoreNepalTaxKnowledgePilotStatus.SKIP
    assert bundle.tax_calculator_invoked is False


def test_no_research_skips() -> None:
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
    bundle = build_core_nepal_tax_knowledge_pilot_bundle(req)
    assert bundle.analysis_status == CoreNepalTaxKnowledgePilotStatus.SKIP
    assert "NO_LEGAL_QUESTION_RESEARCH" in bundle.reason_codes


def test_adapter_metadata() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    ctk = (dto.metadata or {}).get("core_nepal_tax_knowledge_pilot") or {}
    assert ctk.get("tax_calculator_invoked") is False
    assert ctk.get("rate_lookup_executed") is False
    assert ctk.get("current_law_definitive") is False
    assert ctk.get("specialist_signoff_status") == "NOT_SIGNED"
    assert ctk.get("gap_p2_008_status") == "OPEN"
    assert ctk.get("is_execution_authority") is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai37"
        / "frozen"
        / "core_nepal_tax_knowledge_pilot_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.core_nepal_tax_knowledge_pilot_bundle
        assert bundle is not None
        assert bundle.tax_calculator_invoked is False
        assert bundle.current_law_definitive is False
        assert bundle.legal_effective_dates_proven is False
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.tax_pilot_readiness.value == case["expected_readiness"]
            ), case["case_id"]
        if case.get("expected_topic"):
            assert case["expected_topic"] in bundle.in_scope_topics, case[
                "case_id"
            ]
