"""MAI-40 slice 2 — close/adjustment candidate consume (never posts)."""

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
from src.oip.modules.conversation.application.financial_close_adjustment_assistance_consume_service import (
    RUNTIME_VERSION,
    assert_close_assist_consume_authority,
    build_close_assist_candidate,
    close_assist_consume_observability,
    resolve_close_assist_consume_mode,
)
from src.oip.modules.conversation.application.financial_close_adjustment_assistance_service import (
    assert_financial_close_adjustment_assistance_authority,
    attach_financial_close_adjustment_assistance_to_request,
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


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-40.0.2-slice2"


def test_close_candidate_only() -> None:
    req = _pipeline(
        "map expense accounts for financial close adjustments under NFRS"
    )
    bundle = req.financial_close_adjustment_assistance_bundle
    assert_financial_close_adjustment_assistance_authority(bundle)
    mode = resolve_close_assist_consume_mode(
        bundle, allow_close_post=False, allow_adjustment_post=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_close_assist_candidate(bundle)
    assert built["close_assist_consume_mode"] == "CANDIDATE_ONLY"
    assert built["close_assist_consume_ready"] is True
    cand = built["close_assist_candidate"]
    assert cand is not None
    assert "FINANCIAL_CLOSE" in cand["in_scope_topics"]
    assert cand["checklist_refs"] is None
    assert cand["adjustment_drafts"] is None
    assert cand["definitive_answer"] is None
    assert cand["close_posted"] is False
    assert cand["adjustments_posted"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = close_assist_consume_observability(req)
    assert_close_assist_consume_authority(obs)
    assert obs["allow_close_post"] is False
    assert obs["allow_adjustment_post"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "close_assist_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["FINANCIAL_CLOSE"],
        "pilot_scope": "FINANCIAL_CLOSE_ADJUSTMENT_ONLY",
        "adjustment_status": "CANDIDATE_ASSISTANCE_ONLY",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "close_posted": True,
        "is_execution_authority": False,
    }
    assert resolve_close_assist_consume_mode(meta) == "BLOCKED"


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_close_assist_consume_mode(
            req.financial_close_adjustment_assistance_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "map expense accounts for financial close adjustments under NFRS"
    )
    assert (
        resolve_close_assist_consume_mode(
            req.financial_close_adjustment_assistance_bundle,
            allow_close_post=True,
        )
        == "INVOKE_CLOSE_POST"
    )
    assert (
        resolve_close_assist_consume_mode(
            req.financial_close_adjustment_assistance_bundle,
            allow_adjustment_post=True,
        )
        == "INVOKE_ADJUSTMENT_POST"
    )
    obs = close_assist_consume_observability(
        req, allow_close_post=False, allow_adjustment_post=False
    )
    assert obs["close_assist_consume_mode"] == "CANDIDATE_ONLY"
    assert obs["allow_adjustment_post"] is False
    assert obs["close_posted"] is False
    assert obs["adjustments_posted"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "map expense accounts for financial close adjustments under NFRS"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("financial_close_adjustment_assistance") or {}
    assert meta.get("close_assist_consume_mode") == "CANDIDATE_ONLY"
    assert meta.get("close_assist_consume_ready") is True
    assert meta.get("close_posted") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_close_post") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("close_assist_candidate") or {}
    assert cand.get("checklist_refs") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai40"
        / "frozen"
        / "close_assist_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_close_assist_consume_mode(
                case["synthetic_meta"],
                allow_close_post=bool(case.get("allow_close_post", False)),
                allow_adjustment_post=bool(
                    case.get("allow_adjustment_post", False)
                ),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_close_assist_consume_mode(
                req.financial_close_adjustment_assistance_bundle,
                allow_close_post=bool(case.get("allow_close_post", False)),
                allow_adjustment_post=bool(
                    case.get("allow_adjustment_post", False)
                ),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
