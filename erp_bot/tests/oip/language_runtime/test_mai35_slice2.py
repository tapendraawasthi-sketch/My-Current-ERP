"""MAI-35 slice 2 — offline/sync candidate consume (never syncs)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.deterministic_preview_edit_loop_service import (
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
from src.oip.modules.conversation.application.explicit_confirmation_oec_dispatch_service import (
    attach_explicit_confirmation_oec_dispatch_to_request,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.offline_sync_conflict_reversal_consume_service import (
    RUNTIME_VERSION,
    assert_offline_sync_consume_authority,
    build_offline_sync_candidate,
    offline_sync_consume_observability,
    resolve_offline_sync_consume_mode,
)
from src.oip.modules.conversation.application.offline_sync_conflict_reversal_service import (
    assert_offline_sync_conflict_reversal_authority,
    attach_offline_sync_conflict_reversal_to_request,
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
    req = attach_deterministic_preview_edit_loop_to_request(req)
    req = attach_explicit_confirmation_oec_dispatch_to_request(req)
    return attach_offline_sync_conflict_reversal_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-35.0.2-slice2"


def test_purchase_candidate_only() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.offline_sync_conflict_reversal_bundle
    assert_offline_sync_conflict_reversal_authority(bundle)
    mode = resolve_offline_sync_consume_mode(
        bundle,
        allow_sync_push=False,
        allow_conflict_resolve=False,
        allow_reversal_dispatch=False,
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_offline_sync_candidate(
        bundle, field_overrides={"supplier": "Ram", "total_amount": "500"}
    )
    assert built["offline_sync_consume_mode"] == "CANDIDATE_ONLY"
    assert built["offline_sync_consume_ready"] is True
    cand = built["offline_sync_candidate"]
    assert cand is not None
    assert cand["draft_module_id"] == "purchase_draft"
    assert cand["sync_envelope"] is None
    assert cand["conflict_diff"] is None
    assert cand["reversal_envelope"] is None
    assert cand["queued_must_not_label_synced"] is True
    assert cand["conflict_policy"] == "REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT"
    assert cand["reversal_policy"] == "GOVERNED_CORRECTION_ONLY"
    assert cand["field_overrides"]["supplier"] == "Ram"
    assert built["sync_workers_started"] is False
    assert built["gap_p1_002_status"] == "OPEN"
    obs = offline_sync_consume_observability(req)
    assert_offline_sync_consume_authority(obs)
    assert obs["allow_sync_push"] is False
    assert obs["allow_conflict_resolve"] is False
    assert obs["allow_reversal_dispatch"] is False
    assert (obs.get("offline_sync_candidate") or {}).get(
        "field_overrides", {}
    ).get("supplier") == "Ram"


def test_blocked_readiness() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "sync_policy_readiness": "BLOCKED",
        "draft_module_id": "purchase_draft",
        "gap_p1_002_status": "OPEN",
        "gap_p0_001_status": "OPEN",
        "queued_must_not_label_synced": True,
        "retry_must_be_idempotent": True,
        "posted_history_immutable_except_governed_reversal": True,
        "sync_workers_started": False,
        "is_execution_authority": False,
    }
    assert resolve_offline_sync_consume_mode(meta) == "BLOCKED"


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "sync_policy_readiness": "POLICY_DECLARED",
        "draft_module_id": "purchase_draft",
        "gap_p1_002_status": "OPEN",
        "gap_p0_001_status": "OPEN",
        "queued_must_not_label_synced": True,
        "retry_must_be_idempotent": True,
        "posted_history_immutable_except_governed_reversal": True,
        "sync_workers_started": True,
        "is_execution_authority": False,
    }
    assert resolve_offline_sync_consume_mode(meta) == "BLOCKED"


def test_report_skips() -> None:
    req = _pipeline("show balance sheet")
    assert (
        resolve_offline_sync_consume_mode(
            req.offline_sync_conflict_reversal_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline("bought rice from Ram for Rs 500 cash")
    assert (
        resolve_offline_sync_consume_mode(
            req.offline_sync_conflict_reversal_bundle, allow_sync_push=True
        )
        == "INVOKE_SYNC_PUSH"
    )
    assert (
        resolve_offline_sync_consume_mode(
            req.offline_sync_conflict_reversal_bundle,
            allow_conflict_resolve=True,
        )
        == "INVOKE_CONFLICT_RESOLVE"
    )
    assert (
        resolve_offline_sync_consume_mode(
            req.offline_sync_conflict_reversal_bundle,
            allow_reversal_dispatch=True,
        )
        == "INVOKE_REVERSAL_DISPATCH"
    )
    obs = offline_sync_consume_observability(
        req,
        allow_sync_push=False,
        allow_conflict_resolve=False,
        allow_reversal_dispatch=False,
    )
    assert obs["offline_sync_consume_mode"] == "CANDIDATE_ONLY"
    assert obs["allow_sync_push"] is False
    assert obs["sync_workers_started"] is False
    assert obs["queue_enqueued"] is False
    assert obs["conflict_resolved"] is False
    assert obs["reversal_dispatched"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    osc = (dto.metadata or {}).get("offline_sync_conflict_reversal") or {}
    assert osc.get("offline_sync_consume_mode") == "CANDIDATE_ONLY"
    assert osc.get("offline_sync_consume_ready") is True
    assert osc.get("sync_workers_started") is False
    assert osc.get("queue_enqueued") is False
    assert osc.get("gap_p1_002_status") == "OPEN"
    assert osc.get("allow_sync_push") is False
    assert osc.get("is_execution_authority") is False
    cand = osc.get("offline_sync_candidate") or {}
    assert cand.get("draft_module_id") == "purchase_draft"
    assert cand.get("sync_envelope") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai35"
        / "frozen"
        / "offline_sync_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_offline_sync_consume_mode(
                case["synthetic_meta"],
                allow_sync_push=bool(case.get("allow_sync_push", False)),
                allow_conflict_resolve=bool(
                    case.get("allow_conflict_resolve", False)
                ),
                allow_reversal_dispatch=bool(
                    case.get("allow_reversal_dispatch", False)
                ),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_offline_sync_consume_mode(
                req.offline_sync_conflict_reversal_bundle,
                allow_sync_push=bool(case.get("allow_sync_push", False)),
                allow_conflict_resolve=bool(
                    case.get("allow_conflict_resolve", False)
                ),
                allow_reversal_dispatch=bool(
                    case.get("allow_reversal_dispatch", False)
                ),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
