"""MAI-32 slice 2 — DraftAggregate candidate consume (never save_*)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.domain_port_mapping_service import (
    attach_domain_port_mapping_to_request,
)
from src.oip.modules.conversation.application.durable_versioned_draft_consume_service import (
    RUNTIME_VERSION,
    assert_durable_draft_consume_authority,
    build_draft_aggregate_candidate,
    durable_draft_consume_observability,
    resolve_durable_draft_consume_mode,
)
from src.oip.modules.conversation.application.durable_versioned_draft_service import (
    assert_durable_versioned_draft_authority,
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
    return attach_durable_versioned_draft_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-32.0.2-slice2"


def test_purchase_candidate_only() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.durable_versioned_draft_bundle
    assert_durable_versioned_draft_authority(bundle)
    mode = resolve_durable_draft_consume_mode(bundle, allow_durable_write=False)
    assert mode == "CANDIDATE_ONLY"
    built = build_draft_aggregate_candidate(
        bundle, field_overrides={"supplier": "Ram", "total_amount": "500"}
    )
    assert built["durable_consume_mode"] == "CANDIDATE_ONLY"
    assert built["durable_consume_ready"] is True
    cand = built["draft_aggregate_candidate"]
    assert cand is not None
    assert cand["draft_module_id"] == "purchase_draft"
    assert cand["store_filename"] == "purchase_drafts.json"
    assert cand["next_version"] == 1
    assert cand["stale_write_outcome"] == "CONFLICT"
    assert cand["production_store_authority"] is False
    assert cand["field_overrides"]["supplier"] == "Ram"
    assert built["save_invoked"] is False
    assert built["draft_mutations"] == 0
    obs = durable_draft_consume_observability(req)
    assert_durable_draft_consume_authority(obs)
    assert obs["allow_durable_write"] is False
    assert (obs.get("draft_aggregate_candidate") or {}).get(
        "field_overrides", {}
    ).get("supplier") == "Ram"


def test_aggregate_pending_blocked() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "durability_status": "AGGREGATE_PENDING",
        "store_ready_for_annotation": False,
        "draft_module_id": None,
        "production_store_authority": False,
        "save_invoked": False,
        "draft_mutations": 0,
        "is_execution_authority": False,
    }
    assert resolve_durable_draft_consume_mode(meta) == "BLOCKED"


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "durability_status": "EPHEMERAL_LOCAL_JSON",
        "store_ready_for_annotation": True,
        "draft_module_id": "purchase_draft",
        "production_store_authority": True,
        "save_invoked": False,
        "draft_mutations": 0,
        "is_execution_authority": False,
    }
    assert resolve_durable_draft_consume_mode(meta) == "BLOCKED"


def test_report_skips() -> None:
    req = _pipeline("show balance sheet")
    assert resolve_durable_draft_consume_mode(req.durable_versioned_draft_bundle) == (
        "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline("bought rice from Ram for Rs 500 cash")
    mode = resolve_durable_draft_consume_mode(
        req.durable_versioned_draft_bundle, allow_durable_write=True
    )
    assert mode == "INVOKE_SAVE"
    obs = durable_draft_consume_observability(req, allow_durable_write=False)
    assert obs["durable_consume_mode"] == "CANDIDATE_ONLY"
    assert obs["allow_durable_write"] is False
    assert obs["save_invoked"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    dvd = (dto.metadata or {}).get("durable_versioned_draft") or {}
    assert dvd.get("durable_consume_mode") == "CANDIDATE_ONLY"
    assert dvd.get("durable_consume_ready") is True
    assert dvd.get("save_invoked") is False
    assert dvd.get("draft_mutations") == 0
    assert dvd.get("allow_durable_write") is False
    assert dvd.get("is_execution_authority") is False
    cand = dvd.get("draft_aggregate_candidate") or {}
    assert cand.get("draft_module_id") == "purchase_draft"


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai32"
        / "frozen"
        / "durable_draft_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_durable_draft_consume_mode(
                case["synthetic_meta"],
                allow_durable_write=bool(case.get("allow_durable_write", False)),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_durable_draft_consume_mode(
                req.durable_versioned_draft_bundle,
                allow_durable_write=bool(case.get("allow_durable_write", False)),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
