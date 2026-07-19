"""MAI-33 slice 2 — preview-candidate consume (never generates cards)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.deterministic_preview_edit_loop_consume_service import (
    RUNTIME_VERSION,
    assert_preview_edit_loop_consume_authority,
    build_preview_candidate,
    preview_edit_loop_consume_observability,
    resolve_preview_consume_mode,
)
from src.oip.modules.conversation.application.deterministic_preview_edit_loop_service import (
    assert_deterministic_preview_edit_loop_authority,
    attach_deterministic_preview_edit_loop_to_request,
)
from src.oip.modules.conversation.application.domain_port_mapping_service import (
    attach_domain_port_mapping_to_request,
)
from src.oip.modules.conversation.application.durable_versioned_draft_service import (
    attach_durable_versioned_draft_to_request,
)
from src.oip.modules.conversation.application.event_frame_extraction_service import (
    attach_event_frame_extraction_to_request,
)
from src.oip.modules.conversation.application.event_spec_registry_service import (
    attach_event_spec_registry_to_request,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
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
    req = attach_event_spec_registry_to_request(req)
    req = attach_event_frame_extraction_to_request(req)
    req = attach_domain_port_mapping_to_request(req)
    req = attach_durable_versioned_draft_to_request(req)
    return attach_deterministic_preview_edit_loop_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-33.0.2-slice2"


def test_purchase_candidate_only() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.deterministic_preview_edit_loop_bundle
    assert_deterministic_preview_edit_loop_authority(bundle)
    mode = resolve_preview_consume_mode(bundle, allow_preview_generate=False)
    assert mode == "CANDIDATE_ONLY"
    built = build_preview_candidate(
        bundle, field_overrides={"supplier": "Ram", "total_amount": "500"}
    )
    assert built["preview_consume_mode"] == "CANDIDATE_ONLY"
    assert built["preview_consume_ready"] is True
    cand = built["preview_candidate"]
    assert cand is not None
    assert cand["draft_module_id"] == "purchase_draft"
    assert cand["preview_hash"] is None
    assert cand["effects"] is None
    assert cand["stale_preview_on_confirm"] == "REJECT"
    assert cand["field_overrides"]["supplier"] == "Ram"
    assert built["preview_generated"] is False
    assert built["gap_p2_002_status"] == "OPEN"
    obs = preview_edit_loop_consume_observability(req)
    assert_preview_edit_loop_consume_authority(obs)
    assert obs["allow_preview_generate"] is False
    assert (obs.get("preview_candidate") or {}).get("field_overrides", {}).get(
        "supplier"
    ) == "Ram"


def test_blocked_readiness() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "preview_readiness": "BLOCKED",
        "draft_module_id": "purchase_draft",
        "gap_p2_002_status": "OPEN",
        "preview_generated": False,
        "journal_calculated": False,
        "is_execution_authority": False,
    }
    assert resolve_preview_consume_mode(meta) == "BLOCKED"


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "preview_readiness": "POLICY_DECLARED",
        "draft_module_id": "purchase_draft",
        "gap_p2_002_status": "OPEN",
        "preview_generated": True,
        "is_execution_authority": False,
    }
    assert resolve_preview_consume_mode(meta) == "BLOCKED"


def test_report_skips() -> None:
    req = _pipeline("show balance sheet")
    assert resolve_preview_consume_mode(
        req.deterministic_preview_edit_loop_bundle
    ) == "SKIP"


def test_invoke_label_only_not_live() -> None:
    req = _pipeline("bought rice from Ram for Rs 500 cash")
    mode = resolve_preview_consume_mode(
        req.deterministic_preview_edit_loop_bundle, allow_preview_generate=True
    )
    assert mode == "INVOKE_PREVIEW_MESSAGE"
    obs = preview_edit_loop_consume_observability(
        req, allow_preview_generate=False
    )
    assert obs["preview_consume_mode"] == "CANDIDATE_ONLY"
    assert obs["allow_preview_generate"] is False
    assert obs["preview_message_invoked"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    pel = (dto.metadata or {}).get("deterministic_preview_edit_loop") or {}
    assert pel.get("preview_consume_mode") == "CANDIDATE_ONLY"
    assert pel.get("preview_consume_ready") is True
    assert pel.get("preview_generated") is False
    assert pel.get("confirmation_card_generated") is False
    assert pel.get("gap_p2_002_status") == "OPEN"
    assert pel.get("allow_preview_generate") is False
    assert pel.get("is_execution_authority") is False
    cand = pel.get("preview_candidate") or {}
    assert cand.get("draft_module_id") == "purchase_draft"


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai33"
        / "frozen"
        / "preview_edit_loop_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_preview_consume_mode(
                case["synthetic_meta"],
                allow_preview_generate=bool(
                    case.get("allow_preview_generate", False)
                ),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_preview_consume_mode(
                req.deterministic_preview_edit_loop_bundle,
                allow_preview_generate=bool(
                    case.get("allow_preview_generate", False)
                ),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
