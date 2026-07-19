"""MAI-35 slice 1 — offline/sync/conflict/reversal policy (never syncs)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.offline_sync_conflict_reversal import (
    ConflictPolicy,
    OfflineSyncConflictReversalStatus,
    ReversalPolicy,
    SyncPolicyReadiness,
)
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
from src.oip.modules.conversation.application.offline_sync_conflict_reversal_service import (
    RUNTIME_VERSION,
    assert_offline_sync_conflict_reversal_authority,
    attach_offline_sync_conflict_reversal_to_request,
    build_offline_sync_conflict_reversal_bundle,
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


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-35.")


def test_purchase_policy_declared() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.offline_sync_conflict_reversal_bundle
    assert bundle is not None
    assert bundle.analysis_status == OfflineSyncConflictReversalStatus.COMPLETE
    assert bundle.sync_policy_readiness == SyncPolicyReadiness.POLICY_DECLARED
    assert bundle.conflict_policy == (
        ConflictPolicy.REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT
    )
    assert bundle.reversal_policy == ReversalPolicy.GOVERNED_CORRECTION_ONLY
    assert "QUEUED" in bundle.lifecycle_states_declared
    assert "SYNCED" in bundle.lifecycle_states_declared
    assert "CONFLICT" in bundle.lifecycle_states_declared
    assert bundle.queued_must_not_label_synced is True
    assert bundle.retry_must_be_idempotent is True
    assert bundle.gap_p1_002_status == "OPEN"
    assert bundle.gap_p0_001_status == "OPEN"
    assert bundle.sync_workers_started is False
    assert bundle.queue_enqueued is False
    assert bundle.conflict_resolved is False
    assert bundle.reversal_dispatched is False
    assert bundle.queue_mutations == 0
    assert bundle.is_execution_authority is False
    assert "SYNC_POLICY_DECLARED" in bundle.reason_codes
    assert "GAP_P1_002_OPEN" in bundle.reason_codes
    assert_offline_sync_conflict_reversal_authority(bundle)


def test_report_skips() -> None:
    req = _pipeline("show balance sheet")
    bundle = req.offline_sync_conflict_reversal_bundle
    assert bundle is not None
    assert bundle.analysis_status == OfflineSyncConflictReversalStatus.SKIP
    assert bundle.sync_workers_started is False


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.offline_sync_conflict_reversal_bundle
    assert bundle is not None
    assert bundle.analysis_status == OfflineSyncConflictReversalStatus.SKIP


def test_no_confirm_skips() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="Ram bata 500 ko saman kine",
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
    bundle = build_offline_sync_conflict_reversal_bundle(req)
    assert bundle.analysis_status == OfflineSyncConflictReversalStatus.SKIP
    assert "NO_EXPLICIT_CONFIRMATION_OEC_DISPATCH" in bundle.reason_codes


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    osc = (dto.metadata or {}).get("offline_sync_conflict_reversal") or {}
    assert osc.get("sync_workers_started") is False
    assert osc.get("queue_enqueued") is False
    assert osc.get("conflict_resolved") is False
    assert osc.get("reversal_dispatched") is False
    assert osc.get("gap_p1_002_status") == "OPEN"
    assert osc.get("gap_p0_001_status") == "OPEN"
    assert osc.get("queued_must_not_label_synced") is True
    assert osc.get("is_execution_authority") is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai35"
        / "frozen"
        / "offline_sync_conflict_reversal_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.offline_sync_conflict_reversal_bundle
        assert bundle is not None
        assert bundle.sync_workers_started is False
        assert bundle.queue_enqueued is False
        assert bundle.conflict_resolved is False
        assert bundle.reversal_dispatched is False
        assert bundle.gap_p1_002_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.sync_policy_readiness.value == case["expected_readiness"]
            ), case["case_id"]
