"""MAI-39 slice 1 — NFRS/NAS policy/mapping/disclosure pilot (never files)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.nfrs_nas_policy_disclosure_pilot import (
    NfrsNasPilotReadiness,
    NfrsNasPolicyDisclosurePilotStatus,
)
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
from src.oip.modules.conversation.application.legal_question_research_service import (
    attach_legal_question_research_to_request,
)
from src.oip.modules.conversation.application.lexical_index_service import (
    attach_lexical_index_to_request,
)
from src.oip.modules.conversation.application.nfrs_nas_policy_disclosure_pilot_service import (
    RUNTIME_VERSION,
    assert_nfrs_nas_policy_disclosure_pilot_authority,
    attach_nfrs_nas_policy_disclosure_pilot_to_request,
    build_nfrs_nas_policy_disclosure_pilot_bundle,
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
    return attach_nfrs_nas_policy_disclosure_pilot_to_request(req)


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-39.")


def test_nfrs_nas_policy_declared() -> None:
    req = _pipeline(
        "map expense accounts to NAS for financial statements under NFRS"
    )
    bundle = req.nfrs_nas_policy_disclosure_pilot_bundle
    assert bundle is not None
    assert bundle.analysis_status == NfrsNasPolicyDisclosurePilotStatus.COMPLETE
    assert bundle.nfrs_nas_readiness == NfrsNasPilotReadiness.POLICY_DECLARED
    assert "NFRS" in bundle.in_scope_topics
    assert "NAS" in bundle.in_scope_topics
    assert "MAPPING" in bundle.in_scope_topics
    assert bundle.pilot_scope == "NFRS_NAS_DISCLOSURE_ONLY"
    assert bundle.mapping_status == "CANDIDATE_MAPPINGS_ONLY"
    assert bundle.disclosure_status == "NOT_FILED"
    assert bundle.standards_authority_claimed is False
    assert bundle.mapping_executed is False
    assert bundle.disclosure_filed is False
    assert bundle.filing_ready is False
    assert bundle.legal_effective_dates_proven is False
    assert bundle.specialist_signoff_status == "NOT_SIGNED"
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.is_execution_authority is False
    assert "PILOT_SCOPE_NFRS_NAS_DISCLOSURE_ONLY" in bundle.reason_codes
    assert_nfrs_nas_policy_disclosure_pilot_authority(bundle)


def test_disclosure_topic() -> None:
    req = _pipeline(
        "map expense accounts for financial statements under NFRS disclosure"
    )
    bundle = req.nfrs_nas_policy_disclosure_pilot_bundle
    assert bundle is not None
    assert bundle.analysis_status == NfrsNasPolicyDisclosurePilotStatus.COMPLETE
    assert "DISCLOSURE" in bundle.in_scope_topics
    assert "NFRS" in bundle.in_scope_topics


def test_vat_skips() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    bundle = req.nfrs_nas_policy_disclosure_pilot_bundle
    assert bundle is not None
    assert bundle.analysis_status == NfrsNasPolicyDisclosurePilotStatus.SKIP
    assert bundle.mapping_executed is False


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.nfrs_nas_policy_disclosure_pilot_bundle
    assert bundle is not None
    assert bundle.analysis_status == NfrsNasPolicyDisclosurePilotStatus.SKIP


def test_no_research_skips() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="map expense accounts to NAS for financial statements under NFRS",
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
    bundle = build_nfrs_nas_policy_disclosure_pilot_bundle(req)
    assert bundle.analysis_status == NfrsNasPolicyDisclosurePilotStatus.SKIP
    assert "NO_LEGAL_QUESTION_RESEARCH" in bundle.reason_codes


def test_adapter_metadata() -> None:
    req = _pipeline(
        "map expense accounts to NAS for financial statements under NFRS"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("nfrs_nas_policy_disclosure_pilot") or {}
    assert meta.get("standards_authority_claimed") is False
    assert meta.get("mapping_executed") is False
    assert meta.get("disclosure_filed") is False
    assert meta.get("filing_ready") is False
    assert meta.get("mapping_status") == "CANDIDATE_MAPPINGS_ONLY"
    assert meta.get("disclosure_status") == "NOT_FILED"
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("is_execution_authority") is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai39"
        / "frozen"
        / "nfrs_nas_policy_disclosure_pilot_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.nfrs_nas_policy_disclosure_pilot_bundle
        assert bundle is not None
        assert bundle.standards_authority_claimed is False
        assert bundle.mapping_executed is False
        assert bundle.disclosure_filed is False
        assert bundle.filing_ready is False
        assert bundle.legal_effective_dates_proven is False
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.nfrs_nas_readiness.value == case["expected_readiness"]
            ), case["case_id"]
        if case.get("expected_topic"):
            assert case["expected_topic"] in bundle.in_scope_topics, case[
                "case_id"
            ]
