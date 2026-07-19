"""MAI-30 slice 1 — claim-citation / grounded-answer annotation (never verified)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.claim_citation import (
    ClaimCitationStatus,
    ClaimCitationVerificationStatus,
    ClaimCueKind,
    GroundedAnswerPolicy,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.claim_citation_service import (
    RUNTIME_VERSION,
    assert_claim_citation_authority,
    attach_claim_citation_to_request,
    build_claim_citation_bundle,
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
    return attach_claim_citation_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION.startswith("mai-30.")


def test_complete_never_verified() -> None:
    req = _pipeline("show VAT report for this month")
    bundle = req.claim_citation_bundle
    assert bundle is not None
    assert bundle.analysis_status == ClaimCitationStatus.COMPLETE
    assert (
        bundle.grounded_answer_policy
        == GroundedAnswerPolicy.ABSTAIN_WHEN_UNGROUNDED
    )
    assert bundle.verification_status in {
        ClaimCitationVerificationStatus.UNVERIFIED,
        ClaimCitationVerificationStatus.INSUFFICIENT,
    }
    assert bundle.citation_required is True
    assert bundle.claims_verified is False
    assert bundle.citations_verified is False
    assert bundle.verifier_executed is False
    assert bundle.legal_proof_claimed is False
    assert bundle.fake_citation_allowed is False
    assert bundle.is_execution_authority is False
    assert_claim_citation_authority(bundle)


def test_legal_tax_cue() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    bundle = req.claim_citation_bundle
    assert bundle is not None
    assert bundle.analysis_status == ClaimCitationStatus.COMPLETE
    assert any(c.kind == ClaimCueKind.LEGAL_TAX for c in bundle.claim_cues)
    assert bundle.claims_verified is False
    assert "LEGAL_TAX_REQUIRES_GROUNDED_ABSTAIN" in bundle.reason_codes


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.claim_citation_bundle
    assert bundle is not None
    assert bundle.analysis_status == ClaimCitationStatus.SKIP
    assert bundle.claims_verified is False


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    cc = (dto.metadata or {}).get("claim_citation") or {}
    assert cc.get("claims_verified") is False
    assert cc.get("citations_verified") is False
    assert cc.get("verifier_executed") is False
    assert cc.get("legal_proof_claimed") is False
    assert cc.get("fake_citation_allowed") is False
    assert cc.get("is_execution_authority") is False


def test_build_without_governance_skips() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="VAT rate",
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
    bundle = build_claim_citation_bundle(req)
    assert bundle.analysis_status == ClaimCitationStatus.SKIP


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai30"
        / "frozen"
        / "claim_citation_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.claim_citation_bundle
        assert bundle is not None
        assert bundle.claims_verified is False
        assert bundle.citations_verified is False
        assert bundle.verifier_executed is False
        assert bundle.legal_proof_claimed is False
        assert bundle.fake_citation_allowed is False
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_has_legal_tax"):
            assert any(
                c.kind == ClaimCueKind.LEGAL_TAX for c in bundle.claim_cues
            ), case["case_id"]
