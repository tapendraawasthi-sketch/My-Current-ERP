"""MAI-31 slice 2 — draft payload-candidate consume (never executes ports)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.domain_port_consume_service import (
    RUNTIME_VERSION,
    assert_domain_port_consume_authority,
    build_draft_payload_candidate,
    domain_port_consume_observability,
    resolve_port_consume_mode,
)
from src.oip.modules.conversation.application.domain_port_mapping_service import (
    assert_domain_port_mapping_authority,
    attach_domain_port_mapping_to_request,
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
    return attach_domain_port_mapping_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-31.0.2-slice2"


def test_purchase_payload_only() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.domain_port_mapping_bundle
    assert_domain_port_mapping_authority(bundle)
    mode = resolve_port_consume_mode(bundle, allow_port_invoke=False)
    assert mode == "PAYLOAD_ONLY"
    candidate = build_draft_payload_candidate(bundle, req.event_frame)
    assert candidate["port_consume_mode"] == "PAYLOAD_ONLY"
    assert candidate["ready"] is True
    assert candidate["entrypoint"] == "start_or_merge_purchase"
    assert candidate["port_id"] == "purchase_draft_port"
    assert candidate["field_overrides"].get("supplier") == "Ram"
    assert candidate["field_overrides"].get("total_amount") == "500"
    assert candidate["port_executed"] is False
    assert candidate["draft_mutations"] == 0
    obs = domain_port_consume_observability(bundle, req.event_frame)
    assert_domain_port_consume_authority(obs)
    assert obs["allow_port_invoke"] is False


def test_incomplete_or_unsupported_blocked() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "support_status": "INCOMPLETE",
        "selected_draft_entrypoint": "start_or_merge_purchase",
        "selected_port_id": "purchase_draft_port",
        "event_type": "purchase",
        "master_lookup_mode": "ANNOTATION_ONLY",
        "port_executed": False,
        "draft_mutations": 0,
        "is_execution_authority": False,
    }
    assert resolve_port_consume_mode(meta) == "BLOCKED"
    unsup = dict(meta, support_status="UNSUPPORTED")
    assert resolve_port_consume_mode(unsup) == "BLOCKED"


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "support_status": "SUPPORTED",
        "port_executed": True,
        "draft_mutations": 0,
        "master_lookup_mode": "ANNOTATION_ONLY",
        "is_execution_authority": False,
    }
    assert resolve_port_consume_mode(meta) == "BLOCKED"


def test_report_skips() -> None:
    req = _pipeline("show balance sheet")
    mode = resolve_port_consume_mode(req.domain_port_mapping_bundle)
    assert mode == "SKIP"
    candidate = build_draft_payload_candidate(
        req.domain_port_mapping_bundle, req.event_frame
    )
    assert candidate["ready"] is False


def test_default_never_invokes() -> None:
    req = _pipeline("bought rice from Ram for Rs 500 cash")
    # allow_port_invoke True only changes mode label; live enrichment forces False.
    mode = resolve_port_consume_mode(
        req.domain_port_mapping_bundle, allow_port_invoke=True
    )
    assert mode == "INVOKE_START_OR_MERGE"
    obs = domain_port_consume_observability(
        req.domain_port_mapping_bundle, req.event_frame, allow_port_invoke=False
    )
    assert obs["port_consume_mode"] == "PAYLOAD_ONLY"
    assert obs["allow_port_invoke"] is False
    assert obs["draft_mutations"] == 0


def test_adapter_metadata_consume() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    dpm = (dto.metadata or {}).get("domain_port_mapping") or {}
    assert dpm.get("port_consume_mode") == "PAYLOAD_ONLY"
    assert dpm.get("port_consume_ready") is True
    assert dpm.get("port_executed") is False
    assert dpm.get("draft_mutations") == 0
    assert dpm.get("allow_port_invoke") is False
    assert dpm.get("is_execution_authority") is False
    cand = dpm.get("draft_payload_candidate") or {}
    assert cand.get("entrypoint") == "start_or_merge_purchase"


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai31"
        / "frozen"
        / "domain_port_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            meta = case["synthetic_meta"]
            mode = resolve_port_consume_mode(
                meta, allow_port_invoke=bool(case.get("allow_port_invoke", False))
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_port_consume_mode(
                req.domain_port_mapping_bundle,
                allow_port_invoke=bool(case.get("allow_port_invoke", False)),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
