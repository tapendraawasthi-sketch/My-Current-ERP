"""MAI-39 slice 2 — NFRS/NAS candidate consume (never maps/files)."""

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
from src.oip.modules.conversation.application.legal_question_research_service import (
    attach_legal_question_research_to_request,
)
from src.oip.modules.conversation.application.lexical_index_service import (
    attach_lexical_index_to_request,
)
from src.oip.modules.conversation.application.nfrs_nas_policy_disclosure_pilot_consume_service import (
    RUNTIME_VERSION,
    assert_nfrs_nas_consume_authority,
    build_nfrs_nas_candidate,
    nfrs_nas_consume_observability,
    resolve_nfrs_nas_consume_mode,
)
from src.oip.modules.conversation.application.nfrs_nas_policy_disclosure_pilot_service import (
    assert_nfrs_nas_policy_disclosure_pilot_authority,
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
    return attach_nfrs_nas_policy_disclosure_pilot_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-39.0.2-slice2"


def test_nfrs_candidate_only() -> None:
    req = _pipeline(
        "map expense accounts to NAS for financial statements under NFRS"
    )
    bundle = req.nfrs_nas_policy_disclosure_pilot_bundle
    assert_nfrs_nas_policy_disclosure_pilot_authority(bundle)
    mode = resolve_nfrs_nas_consume_mode(
        bundle, allow_mapping_execute=False, allow_disclosure_file=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_nfrs_nas_candidate(bundle)
    assert built["nfrs_nas_consume_mode"] == "CANDIDATE_ONLY"
    assert built["nfrs_nas_consume_ready"] is True
    cand = built["nfrs_nas_candidate"]
    assert cand is not None
    assert "NFRS" in cand["in_scope_topics"]
    assert cand["mapping_refs"] is None
    assert cand["disclosure_draft"] is None
    assert cand["definitive_answer"] is None
    assert cand["mapping_executed"] is False
    assert cand["disclosure_filed"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = nfrs_nas_consume_observability(req)
    assert_nfrs_nas_consume_authority(obs)
    assert obs["allow_mapping_execute"] is False
    assert obs["allow_disclosure_file"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "nfrs_nas_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["NFRS"],
        "pilot_scope": "NFRS_NAS_DISCLOSURE_ONLY",
        "mapping_status": "CANDIDATE_MAPPINGS_ONLY",
        "disclosure_status": "NOT_FILED",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "mapping_executed": True,
        "is_execution_authority": False,
    }
    assert resolve_nfrs_nas_consume_mode(meta) == "BLOCKED"


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_nfrs_nas_consume_mode(
            req.nfrs_nas_policy_disclosure_pilot_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "map expense accounts to NAS for financial statements under NFRS"
    )
    assert (
        resolve_nfrs_nas_consume_mode(
            req.nfrs_nas_policy_disclosure_pilot_bundle,
            allow_mapping_execute=True,
        )
        == "INVOKE_MAPPING_EXECUTE"
    )
    assert (
        resolve_nfrs_nas_consume_mode(
            req.nfrs_nas_policy_disclosure_pilot_bundle,
            allow_disclosure_file=True,
        )
        == "INVOKE_DISCLOSURE_FILE"
    )
    obs = nfrs_nas_consume_observability(
        req, allow_mapping_execute=False, allow_disclosure_file=False
    )
    assert obs["nfrs_nas_consume_mode"] == "CANDIDATE_ONLY"
    assert obs["allow_disclosure_file"] is False
    assert obs["mapping_executed"] is False
    assert obs["disclosure_filed"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "map expense accounts to NAS for financial statements under NFRS"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("nfrs_nas_policy_disclosure_pilot") or {}
    assert meta.get("nfrs_nas_consume_mode") == "CANDIDATE_ONLY"
    assert meta.get("nfrs_nas_consume_ready") is True
    assert meta.get("mapping_executed") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_disclosure_file") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("nfrs_nas_candidate") or {}
    assert cand.get("mapping_refs") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai39"
        / "frozen"
        / "nfrs_nas_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_nfrs_nas_consume_mode(
                case["synthetic_meta"],
                allow_mapping_execute=bool(
                    case.get("allow_mapping_execute", False)
                ),
                allow_disclosure_file=bool(
                    case.get("allow_disclosure_file", False)
                ),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_nfrs_nas_consume_mode(
                req.nfrs_nas_policy_disclosure_pilot_bundle,
                allow_mapping_execute=bool(
                    case.get("allow_mapping_execute", False)
                ),
                allow_disclosure_file=bool(
                    case.get("allow_disclosure_file", False)
                ),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
