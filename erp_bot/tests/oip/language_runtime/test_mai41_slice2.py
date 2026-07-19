"""MAI-41 slice 2 — domain-release candidate consume (never releases)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.broader_nepal_business_law_domain_release_consume_service import (
    RUNTIME_VERSION,
    assert_domain_release_consume_authority,
    build_domain_release_candidate,
    domain_release_consume_observability,
    resolve_domain_release_consume_mode,
)
from src.oip.modules.conversation.application.broader_nepal_business_law_domain_release_service import (
    assert_broader_nepal_business_law_domain_release_authority,
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
    return attach_broader_nepal_business_law_domain_release_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-41.0.2-slice2"


def test_domain_candidate_only() -> None:
    req = _pipeline(
        "map expense accounts for Companies Act disclosure under NFRS"
    )
    bundle = req.broader_nepal_business_law_domain_release_bundle
    assert_broader_nepal_business_law_domain_release_authority(bundle)
    mode = resolve_domain_release_consume_mode(
        bundle, allow_domain_release=False, allow_production_eligible=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_domain_release_candidate(bundle)
    assert built["domain_release_consume_mode"] == "CANDIDATE_ONLY"
    assert built["domain_release_consume_ready"] is True
    cand = built["domain_release_candidate"]
    assert cand is not None
    assert "COMPANY_LAW" in cand["in_scope_topics"]
    assert cand["domain_refs"] is None
    assert cand["release_package"] is None
    assert cand["definitive_answer"] is None
    assert cand["domain_released"] is False
    assert cand["production_domain_eligible"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = domain_release_consume_observability(req)
    assert_domain_release_consume_authority(obs)
    assert obs["allow_domain_release"] is False
    assert obs["allow_production_eligible"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "domain_release_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["COMPANY_LAW"],
        "pilot_scope": "BROADER_NEPAL_BUSINESS_LAW_CANDIDATE_ONLY",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "domain_released": True,
        "is_execution_authority": False,
    }
    assert resolve_domain_release_consume_mode(meta) == "BLOCKED"


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_domain_release_consume_mode(
            req.broader_nepal_business_law_domain_release_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "map expense accounts for Companies Act disclosure under NFRS"
    )
    assert (
        resolve_domain_release_consume_mode(
            req.broader_nepal_business_law_domain_release_bundle,
            allow_domain_release=True,
        )
        == "INVOKE_DOMAIN_RELEASE"
    )
    assert (
        resolve_domain_release_consume_mode(
            req.broader_nepal_business_law_domain_release_bundle,
            allow_production_eligible=True,
        )
        == "INVOKE_PRODUCTION_ELIGIBLE"
    )
    obs = domain_release_consume_observability(
        req, allow_domain_release=False, allow_production_eligible=False
    )
    assert obs["domain_release_consume_mode"] == "CANDIDATE_ONLY"
    assert obs["allow_domain_release"] is False
    assert obs["domain_released"] is False
    assert obs["production_domain_eligible"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "map expense accounts for Companies Act disclosure under NFRS"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get(
        "broader_nepal_business_law_domain_release"
    ) or {}
    assert meta.get("domain_release_consume_mode") == "CANDIDATE_ONLY"
    assert meta.get("domain_release_consume_ready") is True
    assert meta.get("domain_released") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_domain_release") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("domain_release_candidate") or {}
    assert cand.get("domain_refs") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai41"
        / "frozen"
        / "domain_release_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_domain_release_consume_mode(
                case["synthetic_meta"],
                allow_domain_release=bool(
                    case.get("allow_domain_release", False)
                ),
                allow_production_eligible=bool(
                    case.get("allow_production_eligible", False)
                ),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_domain_release_consume_mode(
                req.broader_nepal_business_law_domain_release_bundle,
                allow_domain_release=bool(
                    case.get("allow_domain_release", False)
                ),
                allow_production_eligible=bool(
                    case.get("allow_production_eligible", False)
                ),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
