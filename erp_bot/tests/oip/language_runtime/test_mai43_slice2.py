"""MAI-43 slice 2 — continuous-change candidate consume (never applies)."""

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
from src.oip.modules.conversation.application.continuous_change_intelligence_consume_service import (
    RUNTIME_VERSION,
    assert_continuous_change_consume_authority,
    build_continuous_change_candidate,
    continuous_change_consume_observability,
    resolve_continuous_change_consume_mode,
)
from src.oip.modules.conversation.application.continuous_change_intelligence_service import (
    assert_continuous_change_intelligence_authority,
    attach_continuous_change_intelligence_to_request,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.hybrid_fusion_service import (
    attach_hybrid_fusion_to_request,
)
from src.oip.modules.conversation.application.judicial_decision_intelligence_service import (
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
    req = attach_judicial_decision_intelligence_to_request(req)
    return attach_continuous_change_intelligence_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-43.0.2-slice2"


def test_change_candidate_only() -> None:
    req = _pipeline(
        "map expense accounts for gazette amendment under NFRS"
    )
    bundle = req.continuous_change_intelligence_bundle
    assert_continuous_change_intelligence_authority(bundle)
    mode = resolve_continuous_change_consume_mode(
        bundle, allow_change_apply=False, allow_cache_invalidate=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_continuous_change_candidate(bundle)
    assert built["continuous_change_consume_mode"] == "CANDIDATE_ONLY"
    assert built["continuous_change_consume_ready"] is True
    cand = built["continuous_change_candidate"]
    assert cand is not None
    assert "GAZETTE" in cand["in_scope_topics"]
    assert cand["change_refs"] is None
    assert cand["impact_analysis"] is None
    assert cand["reviewer_queue"] is None
    assert cand["cache_targets"] is None
    assert cand["rollback_plan"] is None
    assert cand["definitive_answer"] is None
    assert cand["change_applied"] is False
    assert cand["unreviewed_as_production_truth"] is False
    assert cand["legal_effective_dates_proven"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = continuous_change_consume_observability(req)
    assert_continuous_change_consume_authority(obs)
    assert obs["allow_change_apply"] is False
    assert obs["allow_cache_invalidate"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "continuous_change_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["AMENDMENT"],
        "pilot_scope": "CONTINUOUS_CHANGE_CANDIDATE_ONLY",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "change_applied": True,
        "is_execution_authority": False,
    }
    assert resolve_continuous_change_consume_mode(meta) == "BLOCKED"


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_continuous_change_consume_mode(
            req.continuous_change_intelligence_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "map expense accounts for gazette amendment under NFRS"
    )
    assert (
        resolve_continuous_change_consume_mode(
            req.continuous_change_intelligence_bundle,
            allow_change_apply=True,
        )
        == "INVOKE_CHANGE_APPLY"
    )
    assert (
        resolve_continuous_change_consume_mode(
            req.continuous_change_intelligence_bundle,
            allow_cache_invalidate=True,
        )
        == "INVOKE_CACHE_INVALIDATE"
    )
    obs = continuous_change_consume_observability(
        req, allow_change_apply=False, allow_cache_invalidate=False
    )
    assert obs["continuous_change_consume_mode"] == "CANDIDATE_ONLY"
    assert obs["allow_change_apply"] is False
    assert obs["change_applied"] is False
    assert obs["cache_invalidated"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "map expense accounts for gazette amendment under NFRS"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("continuous_change_intelligence") or {}
    assert meta.get("continuous_change_consume_mode") == "CANDIDATE_ONLY"
    assert meta.get("continuous_change_consume_ready") is True
    assert meta.get("change_applied") is False
    assert meta.get("unreviewed_as_production_truth") is False
    assert meta.get("legal_effective_dates_proven") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_change_apply") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("continuous_change_candidate") or {}
    assert cand.get("change_refs") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai43"
        / "frozen"
        / "continuous_change_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_continuous_change_consume_mode(
                case["synthetic_meta"],
                allow_change_apply=bool(
                    case.get("allow_change_apply", False)
                ),
                allow_cache_invalidate=bool(
                    case.get("allow_cache_invalidate", False)
                ),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_continuous_change_consume_mode(
                req.continuous_change_intelligence_bundle,
                allow_change_apply=bool(
                    case.get("allow_change_apply", False)
                ),
                allow_cache_invalidate=bool(
                    case.get("allow_cache_invalidate", False)
                ),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
