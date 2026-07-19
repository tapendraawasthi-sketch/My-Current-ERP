"""MAI-38 slice 1 — tax calculator / rule integration policy (never calculates)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.contracts.tax_calculator_rule_integration import (
    CalculatorReadiness,
    TaxCalculatorRuleIntegrationStatus,
)
from src.oip.modules.conversation.application.claim_citation_service import (
    attach_claim_citation_to_request,
)
from src.oip.modules.conversation.application.core_nepal_tax_knowledge_pilot_service import (
    attach_core_nepal_tax_knowledge_pilot_to_request,
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
from src.oip.modules.conversation.application.tax_calculator_rule_integration_service import (
    RUNTIME_VERSION,
    assert_tax_calculator_rule_integration_authority,
    attach_tax_calculator_rule_integration_to_request,
    build_tax_calculator_rule_integration_bundle,
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
    req = attach_core_nepal_tax_knowledge_pilot_to_request(req)
    return attach_tax_calculator_rule_integration_to_request(req)


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-38.")


def test_vat_policy_declared() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    bundle = req.tax_calculator_rule_integration_bundle
    assert bundle is not None
    assert bundle.analysis_status == TaxCalculatorRuleIntegrationStatus.COMPLETE
    assert bundle.calculator_readiness == CalculatorReadiness.POLICY_DECLARED
    assert bundle.rule_integration_status == "POLICY_ONLY"
    assert bundle.pilot_bound is True
    assert bundle.tax_calculator_invoked is False
    assert bundle.calculation_executed is False
    assert bundle.amount_computed is False
    assert bundle.rate_applied is False
    assert bundle.rule_table_loaded is False
    assert bundle.calculator_production_eligible is False
    assert bundle.current_law_definitive is False
    assert bundle.legal_effective_dates_proven is False
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.documents_retrieved == 0
    assert bundle.is_execution_authority is False
    assert "CALCULATOR_POLICY_DECLARED" in bundle.reason_codes
    assert "NO_LIVE_CALCULATION" in bundle.reason_codes
    assert_tax_calculator_rule_integration_authority(bundle)


def test_calc_intent_not_executed() -> None:
    req = _pipeline("calculate VAT on 100000 under VAT Act")
    bundle = req.tax_calculator_rule_integration_bundle
    assert bundle is not None
    assert bundle.analysis_status == TaxCalculatorRuleIntegrationStatus.COMPLETE
    assert bundle.calc_intent_detected is True
    assert bundle.calculation_executed is False
    assert bundle.amount_computed is False
    assert "CALC_INTENT_DETECTED_NOT_EXECUTED" in bundle.reason_codes


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.tax_calculator_rule_integration_bundle
    assert bundle is not None
    assert bundle.analysis_status == TaxCalculatorRuleIntegrationStatus.SKIP
    assert bundle.calculation_executed is False


def test_no_pilot_skips() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="calculate VAT on 100000 under VAT Act",
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
    bundle = build_tax_calculator_rule_integration_bundle(req)
    assert bundle.analysis_status == TaxCalculatorRuleIntegrationStatus.SKIP
    assert "NO_TAX_PILOT" in bundle.reason_codes


def test_adapter_metadata() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    tcri = (dto.metadata or {}).get("tax_calculator_rule_integration") or {}
    assert tcri.get("tax_calculator_invoked") is False
    assert tcri.get("calculation_executed") is False
    assert tcri.get("amount_computed") is False
    assert tcri.get("calculator_production_eligible") is False
    assert tcri.get("rule_integration_status") == "POLICY_ONLY"
    assert tcri.get("gap_p2_008_status") == "OPEN"
    assert tcri.get("is_execution_authority") is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai38"
        / "frozen"
        / "tax_calculator_rule_integration_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.tax_calculator_rule_integration_bundle
        assert bundle is not None
        assert bundle.tax_calculator_invoked is False
        assert bundle.calculation_executed is False
        assert bundle.amount_computed is False
        assert bundle.calculator_production_eligible is False
        assert bundle.legal_effective_dates_proven is False
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.calculator_readiness.value == case["expected_readiness"]
            ), case["case_id"]
