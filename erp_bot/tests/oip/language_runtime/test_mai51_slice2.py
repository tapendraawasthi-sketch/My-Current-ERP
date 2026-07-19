"""MAI-51 slice 2 — private user-document intelligence candidate consume."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.private_user_document_intelligence_consume_service import (
    RUNTIME_VERSION,
    assert_private_user_document_intelligence_consume_authority,
    build_private_user_document_intelligence_candidate,
    private_user_document_intelligence_consume_observability,
    resolve_private_user_document_intelligence_consume_mode,
)
from src.oip.modules.conversation.application.private_user_document_intelligence_service import (
    assert_private_user_document_intelligence_authority,
    attach_private_user_document_intelligence_to_request,
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
    return attach_private_user_document_intelligence_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-51.0.2-slice2"


def test_document_candidate_only() -> None:
    req = _pipeline(
        "private document intelligence with user upload and document Q&A"
    )
    bundle = req.private_user_document_intelligence_bundle
    assert_private_user_document_intelligence_authority(bundle)
    mode = resolve_private_user_document_intelligence_consume_mode(
        bundle, allow_ingest=False, allow_qa=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_private_user_document_intelligence_candidate(bundle)
    assert (
        built["private_user_document_intelligence_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert built["private_user_document_intelligence_consume_ready"] is True
    cand = built["private_user_document_intelligence_candidate"]
    assert cand is not None
    assert "PRIVATE_DOCUMENT" in cand["in_scope_topics"]
    assert cand["upload_plan"] is None
    assert cand["ingest_plan"] is None
    assert cand["index_plan"] is None
    assert cand["qa_plan"] is None
    assert cand["summary_plan"] is None
    assert cand["extraction_plan"] is None
    assert cand["retention_plan"] is None
    assert cand["access_control_plan"] is None
    assert cand["definitive_answer"] is None
    assert cand["document_ingested"] is False
    assert cand["document_qa_live"] is False
    assert cand["cross_tenant_isolation_proven"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = private_user_document_intelligence_consume_observability(req)
    assert_private_user_document_intelligence_consume_authority(obs)
    assert obs["allow_ingest"] is False
    assert obs["allow_qa"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "private_user_document_intelligence_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["DOCUMENT_QA"],
        "pilot_scope": "PRIVATE_USER_DOCUMENT_INTELLIGENCE_CANDIDATE_ONLY",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "document_ingested": True,
        "is_execution_authority": False,
    }
    assert (
        resolve_private_user_document_intelligence_consume_mode(meta)
        == "BLOCKED"
    )


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_private_user_document_intelligence_consume_mode(
            req.private_user_document_intelligence_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "private document intelligence with user upload and document Q&A"
    )
    assert (
        resolve_private_user_document_intelligence_consume_mode(
            req.private_user_document_intelligence_bundle,
            allow_ingest=True,
        )
        == "INVOKE_INGEST"
    )
    assert (
        resolve_private_user_document_intelligence_consume_mode(
            req.private_user_document_intelligence_bundle,
            allow_qa=True,
        )
        == "INVOKE_QA"
    )
    obs = private_user_document_intelligence_consume_observability(
        req, allow_ingest=False, allow_qa=False
    )
    assert (
        obs["private_user_document_intelligence_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert obs["allow_ingest"] is False
    assert obs["document_ingested"] is False
    assert obs["document_qa_live"] is False
    assert obs["private_document_intelligence_enabled"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "private document intelligence with user upload and document Q&A"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("private_user_document_intelligence") or {}
    assert (
        meta.get("private_user_document_intelligence_consume_mode")
        == "CANDIDATE_ONLY"
    )
    assert (
        meta.get("private_user_document_intelligence_consume_ready") is True
    )
    assert meta.get("document_ingested") is False
    assert meta.get("document_qa_live") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_ingest") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("private_user_document_intelligence_candidate") or {}
    assert cand.get("ingest_plan") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai51"
        / "frozen"
        / "private_user_document_intelligence_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_private_user_document_intelligence_consume_mode(
                case["synthetic_meta"],
                allow_ingest=bool(case.get("allow_ingest", False)),
                allow_qa=bool(case.get("allow_qa", False)),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_private_user_document_intelligence_consume_mode(
                req.private_user_document_intelligence_bundle,
                allow_ingest=bool(case.get("allow_ingest", False)),
                allow_qa=bool(case.get("allow_qa", False)),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
