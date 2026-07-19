"""MAI-42 slice 2 — judicial-decision candidate consume (never retrieves)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.broader_nepal_business_law_domain_release_service import (
    attach_broader_nepal_business_law_domain_release_to_request,
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
from src.oip.modules.conversation.application.judicial_decision_intelligence_consume_service import (
    RUNTIME_VERSION,
    assert_judicial_decision_consume_authority,
    build_judicial_decision_candidate,
    judicial_decision_consume_observability,
    resolve_judicial_decision_consume_mode,
)
from src.oip.modules.conversation.application.judicial_decision_intelligence_service import (
    assert_judicial_decision_intelligence_authority,
    attach_judicial_decision_intelligence_to_request,
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
    req = attach_broader_nepal_business_law_domain_release_to_request(req)
    return attach_judicial_decision_intelligence_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-42.0.2-slice2"


def test_judicial_candidate_only() -> None:
    req = _pipeline(
        "map expense accounts for Supreme Court decision holding under NFRS"
    )
    bundle = req.judicial_decision_intelligence_bundle
    assert_judicial_decision_intelligence_authority(bundle)
    mode = resolve_judicial_decision_consume_mode(
        bundle, allow_case_retrieve=False, allow_judicial_authority=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_judicial_decision_candidate(bundle)
    assert built["judicial_decision_consume_mode"] == "CANDIDATE_ONLY"
    assert built["judicial_decision_consume_ready"] is True
    cand = built["judicial_decision_candidate"]
    assert cand is not None
    assert "COURT_DECISION" in cand["in_scope_topics"]
    assert cand["case_refs"] is None
    assert cand["holdings"] is None
    assert cand["citator_links"] is None
    assert cand["paragraph_anchors"] is None
    assert cand["definitive_answer"] is None
    assert cand["case_retrieved"] is False
    assert cand["headnote_as_binding_rule"] is False
    assert cand["subsequent_treatment_definitive"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = judicial_decision_consume_observability(req)
    assert_judicial_decision_consume_authority(obs)
    assert obs["allow_case_retrieve"] is False
    assert obs["allow_judicial_authority"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "judicial_decision_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["COURT_DECISION"],
        "pilot_scope": "JUDICIAL_DECISION_CANDIDATE_ONLY",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "case_retrieved": True,
        "is_execution_authority": False,
    }
    assert resolve_judicial_decision_consume_mode(meta) == "BLOCKED"


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_judicial_decision_consume_mode(
            req.judicial_decision_intelligence_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "map expense accounts for Supreme Court decision holding under NFRS"
    )
    assert (
        resolve_judicial_decision_consume_mode(
            req.judicial_decision_intelligence_bundle,
            allow_case_retrieve=True,
        )
        == "INVOKE_CASE_RETRIEVE"
    )
    assert (
        resolve_judicial_decision_consume_mode(
            req.judicial_decision_intelligence_bundle,
            allow_judicial_authority=True,
        )
        == "INVOKE_JUDICIAL_AUTHORITY"
    )
    obs = judicial_decision_consume_observability(
        req, allow_case_retrieve=False, allow_judicial_authority=False
    )
    assert obs["judicial_decision_consume_mode"] == "CANDIDATE_ONLY"
    assert obs["allow_case_retrieve"] is False
    assert obs["case_retrieved"] is False
    assert obs["judicial_authority_claimed"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "map expense accounts for Supreme Court decision holding under NFRS"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("judicial_decision_intelligence") or {}
    assert meta.get("judicial_decision_consume_mode") == "CANDIDATE_ONLY"
    assert meta.get("judicial_decision_consume_ready") is True
    assert meta.get("case_retrieved") is False
    assert meta.get("headnote_as_binding_rule") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_case_retrieve") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("judicial_decision_candidate") or {}
    assert cand.get("case_refs") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai42"
        / "frozen"
        / "judicial_decision_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_judicial_decision_consume_mode(
                case["synthetic_meta"],
                allow_case_retrieve=bool(
                    case.get("allow_case_retrieve", False)
                ),
                allow_judicial_authority=bool(
                    case.get("allow_judicial_authority", False)
                ),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_judicial_decision_consume_mode(
                req.judicial_decision_intelligence_bundle,
                allow_case_retrieve=bool(
                    case.get("allow_case_retrieve", False)
                ),
                allow_judicial_authority=bool(
                    case.get("allow_judicial_authority", False)
                ),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
