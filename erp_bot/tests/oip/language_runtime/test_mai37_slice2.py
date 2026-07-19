"""MAI-37 slice 2 — tax-pilot candidate consume (never calculates)."""

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
from src.oip.modules.conversation.application.core_nepal_tax_knowledge_pilot_consume_service import (
    RUNTIME_VERSION,
    assert_tax_pilot_consume_authority,
    build_tax_pilot_candidate,
    resolve_tax_pilot_consume_mode,
    tax_pilot_consume_observability,
)
from src.oip.modules.conversation.application.core_nepal_tax_knowledge_pilot_service import (
    assert_core_nepal_tax_knowledge_pilot_authority,
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


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-37.0.2-slice2"


def test_vat_candidate_only() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    bundle = req.core_nepal_tax_knowledge_pilot_bundle
    assert_core_nepal_tax_knowledge_pilot_authority(bundle)
    mode = resolve_tax_pilot_consume_mode(
        bundle, allow_rate_lookup=False, allow_tax_calculator=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_tax_pilot_candidate(bundle)
    assert built["tax_pilot_consume_mode"] == "CANDIDATE_ONLY"
    assert built["tax_pilot_consume_ready"] is True
    cand = built["tax_pilot_candidate"]
    assert cand is not None
    assert "VAT" in cand["in_scope_topics"]
    assert cand["rate_table_refs"] is None
    assert cand["computed_amount"] is None
    assert cand["definitive_answer"] is None
    assert cand["tax_calculator_invoked"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = tax_pilot_consume_observability(req)
    assert_tax_pilot_consume_authority(obs)
    assert obs["allow_rate_lookup"] is False
    assert obs["allow_tax_calculator"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "tax_pilot_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["VAT"],
        "pilot_scope": "INCOME_TAX_VAT_TDS_ONLY",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "gold_questions_status": "NOT_RELEASED",
        "tax_calculator_invoked": True,
        "is_execution_authority": False,
    }
    assert resolve_tax_pilot_consume_mode(meta) == "BLOCKED"


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_tax_pilot_consume_mode(
            req.core_nepal_tax_knowledge_pilot_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    assert (
        resolve_tax_pilot_consume_mode(
            req.core_nepal_tax_knowledge_pilot_bundle, allow_rate_lookup=True
        )
        == "INVOKE_RATE_LOOKUP"
    )
    assert (
        resolve_tax_pilot_consume_mode(
            req.core_nepal_tax_knowledge_pilot_bundle,
            allow_tax_calculator=True,
        )
        == "INVOKE_TAX_CALCULATOR"
    )
    obs = tax_pilot_consume_observability(
        req, allow_rate_lookup=False, allow_tax_calculator=False
    )
    assert obs["tax_pilot_consume_mode"] == "CANDIDATE_ONLY"
    assert obs["allow_tax_calculator"] is False
    assert obs["tax_calculator_invoked"] is False
    assert obs["rate_lookup_executed"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    ctk = (dto.metadata or {}).get("core_nepal_tax_knowledge_pilot") or {}
    assert ctk.get("tax_pilot_consume_mode") == "CANDIDATE_ONLY"
    assert ctk.get("tax_pilot_consume_ready") is True
    assert ctk.get("tax_calculator_invoked") is False
    assert ctk.get("gap_p2_008_status") == "OPEN"
    assert ctk.get("allow_tax_calculator") is False
    assert ctk.get("is_execution_authority") is False
    cand = ctk.get("tax_pilot_candidate") or {}
    assert cand.get("computed_amount") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai37"
        / "frozen"
        / "tax_pilot_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_tax_pilot_consume_mode(
                case["synthetic_meta"],
                allow_rate_lookup=bool(case.get("allow_rate_lookup", False)),
                allow_tax_calculator=bool(
                    case.get("allow_tax_calculator", False)
                ),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_tax_pilot_consume_mode(
                req.core_nepal_tax_knowledge_pilot_bundle,
                allow_rate_lookup=bool(case.get("allow_rate_lookup", False)),
                allow_tax_calculator=bool(
                    case.get("allow_tax_calculator", False)
                ),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
