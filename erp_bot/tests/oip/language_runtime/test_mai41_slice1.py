"""MAI-41 slice 1 — broader Nepal business-law domain release (never releases)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.broader_nepal_business_law_domain_release import (
    BroaderNepalBusinessLawDomainReleaseStatus,
    DomainReleaseReadiness,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.broader_nepal_business_law_domain_release_service import (
    RUNTIME_VERSION,
    assert_broader_nepal_business_law_domain_release_authority,
    attach_broader_nepal_business_law_domain_release_to_request,
    build_broader_nepal_business_law_domain_release_bundle,
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


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-41.0.1-slice1"


def test_company_law_policy_declared() -> None:
    req = _pipeline(
        "map expense accounts for Companies Act disclosure under NFRS"
    )
    bundle = req.broader_nepal_business_law_domain_release_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status
        == BroaderNepalBusinessLawDomainReleaseStatus.COMPLETE
    )
    assert (
        bundle.domain_release_readiness == DomainReleaseReadiness.POLICY_DECLARED
    )
    assert "COMPANY_LAW" in bundle.in_scope_topics
    assert bundle.pilot_scope == "BROADER_NEPAL_BUSINESS_LAW_CANDIDATE_ONLY"
    assert bundle.release_status == "NOT_RELEASED"
    assert bundle.gold_questions_status == "NOT_RELEASED"
    assert bundle.domain_authority_claimed is False
    assert bundle.domain_released is False
    assert bundle.production_domain_eligible is False
    assert bundle.legal_effective_dates_proven is False
    assert bundle.specialist_signoff_status == "NOT_SIGNED"
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.is_execution_authority is False
    assert (
        "PILOT_SCOPE_BROADER_NEPAL_BUSINESS_LAW_CANDIDATE_ONLY"
        in bundle.reason_codes
    )
    assert_broader_nepal_business_law_domain_release_authority(bundle)


def test_labor_and_domain_release() -> None:
    req = _pipeline(
        "map expense accounts for broader Nepal business-law domain release under NFRS"
    )
    bundle = req.broader_nepal_business_law_domain_release_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status
        == BroaderNepalBusinessLawDomainReleaseStatus.COMPLETE
    )
    assert "BUSINESS_LAW_DOMAIN" in bundle.in_scope_topics
    assert "DOMAIN_RELEASE" in bundle.in_scope_topics


def test_vat_skips() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    bundle = req.broader_nepal_business_law_domain_release_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status
        == BroaderNepalBusinessLawDomainReleaseStatus.SKIP
    )
    assert bundle.domain_released is False


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.broader_nepal_business_law_domain_release_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status
        == BroaderNepalBusinessLawDomainReleaseStatus.SKIP
    )


def test_no_research_skips() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="map expense accounts for Companies Act disclosure under NFRS",
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
    bundle = build_broader_nepal_business_law_domain_release_bundle(req)
    assert (
        bundle.analysis_status
        == BroaderNepalBusinessLawDomainReleaseStatus.SKIP
    )
    assert "NO_LEGAL_QUESTION_RESEARCH" in bundle.reason_codes


def test_adapter_metadata() -> None:
    req = _pipeline(
        "map expense accounts for Companies Act disclosure under NFRS"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get(
        "broader_nepal_business_law_domain_release"
    ) or {}
    assert meta.get("domain_authority_claimed") is False
    assert meta.get("domain_released") is False
    assert meta.get("production_domain_eligible") is False
    assert meta.get("release_status") == "NOT_RELEASED"
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("is_execution_authority") is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai41"
        / "frozen"
        / "broader_nepal_business_law_domain_release_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.broader_nepal_business_law_domain_release_bundle
        assert bundle is not None
        assert bundle.domain_authority_claimed is False
        assert bundle.domain_released is False
        assert bundle.production_domain_eligible is False
        assert bundle.legal_effective_dates_proven is False
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.domain_release_readiness.value
                == case["expected_readiness"]
            ), case["case_id"]
        if case.get("expected_topic"):
            assert case["expected_topic"] in bundle.in_scope_topics, case[
                "case_id"
            ]
