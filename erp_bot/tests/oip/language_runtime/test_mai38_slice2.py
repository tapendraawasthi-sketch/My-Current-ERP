"""MAI-38 slice 2 — calculator/rule candidate consume (never calculates)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
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
from src.oip.modules.conversation.application.tax_calculator_rule_integration_consume_service import (
    RUNTIME_VERSION,
    assert_calculator_consume_authority,
    build_calculator_rule_candidate,
    calculator_consume_observability,
    resolve_calculator_consume_mode,
)
from src.oip.modules.conversation.application.tax_calculator_rule_integration_service import (
    assert_tax_calculator_rule_integration_authority,
    attach_tax_calculator_rule_integration_to_request,
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


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-38.0.2-slice2"


def test_vat_candidate_only() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    bundle = req.tax_calculator_rule_integration_bundle
    assert_tax_calculator_rule_integration_authority(bundle)
    mode = resolve_calculator_consume_mode(
        bundle, allow_rule_table_load=False, allow_live_calculation=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_calculator_rule_candidate(bundle)
    assert built["calculator_consume_mode"] == "CANDIDATE_ONLY"
    assert built["calculator_consume_ready"] is True
    cand = built["calculator_rule_candidate"]
    assert cand is not None
    assert cand["rule_table_refs"] is None
    assert cand["computed_amount"] is None
    assert cand["applied_rate"] is None
    assert cand["definitive_answer"] is None
    assert cand["calculation_executed"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = calculator_consume_observability(req)
    assert_calculator_consume_authority(obs)
    assert obs["allow_rule_table_load"] is False
    assert obs["allow_live_calculation"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "calculator_readiness": "POLICY_DECLARED",
        "pilot_bound": True,
        "rule_integration_status": "POLICY_ONLY",
        "gap_p2_008_status": "OPEN",
        "calculation_executed": True,
        "is_execution_authority": False,
    }
    assert resolve_calculator_consume_mode(meta) == "BLOCKED"


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_calculator_consume_mode(
            req.tax_calculator_rule_integration_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    assert (
        resolve_calculator_consume_mode(
            req.tax_calculator_rule_integration_bundle,
            allow_rule_table_load=True,
        )
        == "INVOKE_RULE_TABLE_LOAD"
    )
    assert (
        resolve_calculator_consume_mode(
            req.tax_calculator_rule_integration_bundle,
            allow_live_calculation=True,
        )
        == "INVOKE_LIVE_CALCULATION"
    )
    obs = calculator_consume_observability(
        req, allow_rule_table_load=False, allow_live_calculation=False
    )
    assert obs["calculator_consume_mode"] == "CANDIDATE_ONLY"
    assert obs["allow_live_calculation"] is False
    assert obs["calculation_executed"] is False
    assert obs["rule_table_loaded"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    tcri = (dto.metadata or {}).get("tax_calculator_rule_integration") or {}
    assert tcri.get("calculator_consume_mode") == "CANDIDATE_ONLY"
    assert tcri.get("calculator_consume_ready") is True
    assert tcri.get("calculation_executed") is False
    assert tcri.get("gap_p2_008_status") == "OPEN"
    assert tcri.get("allow_live_calculation") is False
    assert tcri.get("is_execution_authority") is False
    cand = tcri.get("calculator_rule_candidate") or {}
    assert cand.get("computed_amount") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai38"
        / "frozen"
        / "calculator_rule_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_calculator_consume_mode(
                case["synthetic_meta"],
                allow_rule_table_load=bool(
                    case.get("allow_rule_table_load", False)
                ),
                allow_live_calculation=bool(
                    case.get("allow_live_calculation", False)
                ),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_calculator_consume_mode(
                req.tax_calculator_rule_integration_bundle,
                allow_rule_table_load=bool(
                    case.get("allow_rule_table_load", False)
                ),
                allow_live_calculation=bool(
                    case.get("allow_live_calculation", False)
                ),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
