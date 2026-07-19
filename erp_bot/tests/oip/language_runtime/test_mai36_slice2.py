"""MAI-36 slice 2 — legal research-frame candidate consume (never proves law)."""

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
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.hybrid_fusion_service import (
    attach_hybrid_fusion_to_request,
)
from src.oip.modules.conversation.application.knowledge_source_governance_service import (
    attach_knowledge_source_governance_to_request,
)
from src.oip.modules.conversation.application.legal_question_research_consume_service import (
    RUNTIME_VERSION,
    assert_legal_research_consume_authority,
    build_legal_research_candidate,
    legal_research_consume_observability,
    resolve_legal_research_consume_mode,
)
from src.oip.modules.conversation.application.legal_question_research_service import (
    assert_legal_question_research_authority,
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
    return attach_legal_question_research_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-36.0.2-slice2"


def test_legal_candidate_only_clarify() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    bundle = req.legal_question_research_bundle
    assert_legal_question_research_authority(bundle)
    mode = resolve_legal_research_consume_mode(
        bundle, allow_research_planner=False, allow_kb_retrieval=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_legal_research_candidate(bundle)
    assert built["legal_research_consume_mode"] == "CANDIDATE_ONLY"
    assert built["legal_research_consume_ready"] is True
    cand = built["legal_research_candidate"]
    assert cand is not None
    assert cand["research_mode_active"] is True
    assert cand["research_plan"] is None
    assert cand["evidence_pack"] is None
    assert cand["definitive_answer"] is None
    assert cand["current_law_definitive"] is False
    assert cand["legal_effective_dates_proven"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = legal_research_consume_observability(req)
    assert_legal_research_consume_authority(obs)
    assert obs["allow_research_planner"] is False
    assert obs["allow_kb_retrieval"] is False


def test_legal_candidate_policy_declared() -> None:
    req = _pipeline("show current VAT rate in Nepal under VAT Act as of 2024")
    mode = resolve_legal_research_consume_mode(
        req.legal_question_research_bundle
    )
    assert mode == "CANDIDATE_ONLY"
    cand = build_legal_research_candidate(
        req.legal_question_research_bundle
    )["legal_research_candidate"]
    assert cand is not None
    assert cand["jurisdiction_candidate"] is not None


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "research_mode_readiness": "POLICY_DECLARED",
        "research_mode_active": True,
        "gap_p2_008_status": "OPEN",
        "accounting_action_separated": True,
        "mutation_tools_allowed": False,
        "current_law_definitive": True,
        "is_execution_authority": False,
    }
    assert resolve_legal_research_consume_mode(meta) == "BLOCKED"


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_legal_research_consume_mode(
            req.legal_question_research_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    assert (
        resolve_legal_research_consume_mode(
            req.legal_question_research_bundle, allow_research_planner=True
        )
        == "INVOKE_RESEARCH_PLANNER"
    )
    assert (
        resolve_legal_research_consume_mode(
            req.legal_question_research_bundle, allow_kb_retrieval=True
        )
        == "INVOKE_KB_RETRIEVAL"
    )
    obs = legal_research_consume_observability(
        req, allow_research_planner=False, allow_kb_retrieval=False
    )
    assert obs["legal_research_consume_mode"] == "CANDIDATE_ONLY"
    assert obs["allow_research_planner"] is False
    assert obs["research_planner_executed"] is False
    assert obs["kb_retrieval_invoked"] is False
    assert obs["current_law_definitive"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    lqr = (dto.metadata or {}).get("legal_question_research") or {}
    assert lqr.get("legal_research_consume_mode") == "CANDIDATE_ONLY"
    assert lqr.get("legal_research_consume_ready") is True
    assert lqr.get("mutation_tools_allowed") is False
    assert lqr.get("current_law_definitive") is False
    assert lqr.get("gap_p2_008_status") == "OPEN"
    assert lqr.get("allow_research_planner") is False
    assert lqr.get("is_execution_authority") is False
    cand = lqr.get("legal_research_candidate") or {}
    assert cand.get("research_plan") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai36"
        / "frozen"
        / "legal_research_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_legal_research_consume_mode(
                case["synthetic_meta"],
                allow_research_planner=bool(
                    case.get("allow_research_planner", False)
                ),
                allow_kb_retrieval=bool(case.get("allow_kb_retrieval", False)),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_legal_research_consume_mode(
                req.legal_question_research_bundle,
                allow_research_planner=bool(
                    case.get("allow_research_planner", False)
                ),
                allow_kb_retrieval=bool(case.get("allow_kb_retrieval", False)),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
