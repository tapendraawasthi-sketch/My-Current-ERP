"""MAI-34 slice 2 — confirm/OEC candidate consume (never posts)."""

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
from src.oip.modules.conversation.application.explicit_confirmation_oec_dispatch_consume_service import (
    RUNTIME_VERSION,
    assert_confirm_oec_consume_authority,
    build_confirm_oec_candidate,
    confirm_oec_consume_observability,
    resolve_confirm_oec_consume_mode,
)
from src.oip.modules.conversation.application.explicit_confirmation_oec_dispatch_service import (
    assert_explicit_confirmation_oec_dispatch_authority,
    attach_explicit_confirmation_oec_dispatch_to_request,
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
    req = attach_deterministic_preview_edit_loop_to_request(req)
    return attach_explicit_confirmation_oec_dispatch_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-34.0.2-slice2"


def test_purchase_candidate_only() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.explicit_confirmation_oec_dispatch_bundle
    assert_explicit_confirmation_oec_dispatch_authority(bundle)
    mode = resolve_confirm_oec_consume_mode(
        bundle, allow_confirm_dispatch=False, allow_oec_dispatch=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_confirm_oec_candidate(
        bundle, field_overrides={"supplier": "Ram", "total_amount": "500"}
    )
    assert built["confirm_oec_consume_mode"] == "CANDIDATE_ONLY"
    assert built["confirm_oec_consume_ready"] is True
    cand = built["confirm_oec_candidate"]
    assert cand is not None
    assert cand["draft_module_id"] == "purchase_draft"
    assert cand["confirm_token"] is None
    assert cand["confirm_token_status"] == "NOT_ISSUED"
    assert cand["oec_dispatch_envelope"] is None
    assert cand["stale_preview_on_confirm"] == "REJECT"
    assert cand["nl_assent_posts"] is False
    assert cand["product_mutation_path"] == "DEXIE_EXECUTE_ORBIX_CONFIRM"
    assert cand["field_overrides"]["supplier"] == "Ram"
    assert built["confirm_token_minted"] is False
    assert built["gap_p0_001_status"] == "OPEN"
    obs = confirm_oec_consume_observability(req)
    assert_confirm_oec_consume_authority(obs)
    assert obs["allow_confirm_dispatch"] is False
    assert obs["allow_oec_dispatch"] is False
    assert (obs.get("confirm_oec_candidate") or {}).get(
        "field_overrides", {}
    ).get("supplier") == "Ram"


def test_blocked_readiness() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "confirm_readiness": "BLOCKED",
        "oec_dispatch_readiness": "BLOCKED",
        "draft_module_id": "purchase_draft",
        "gap_p0_001_status": "OPEN",
        "confirm_token_status": "NOT_ISSUED",
        "nl_assent_posts": False,
        "confirm_token_minted": False,
        "is_execution_authority": False,
    }
    assert resolve_confirm_oec_consume_mode(meta) == "BLOCKED"


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "confirm_readiness": "POLICY_DECLARED",
        "oec_dispatch_readiness": "POLICY_DECLARED",
        "draft_module_id": "purchase_draft",
        "gap_p0_001_status": "OPEN",
        "confirm_token_status": "NOT_ISSUED",
        "nl_assent_posts": False,
        "confirm_token_minted": True,
        "is_execution_authority": False,
    }
    assert resolve_confirm_oec_consume_mode(meta) == "BLOCKED"


def test_report_skips() -> None:
    req = _pipeline("show balance sheet")
    assert (
        resolve_confirm_oec_consume_mode(
            req.explicit_confirmation_oec_dispatch_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline("bought rice from Ram for Rs 500 cash")
    mode = resolve_confirm_oec_consume_mode(
        req.explicit_confirmation_oec_dispatch_bundle,
        allow_confirm_dispatch=True,
    )
    assert mode == "INVOKE_DEXIE_CONFIRM"
    mode_oec = resolve_confirm_oec_consume_mode(
        req.explicit_confirmation_oec_dispatch_bundle,
        allow_oec_dispatch=True,
    )
    assert mode_oec == "INVOKE_OEC_DISPATCH"
    obs = confirm_oec_consume_observability(
        req, allow_confirm_dispatch=False, allow_oec_dispatch=False
    )
    assert obs["confirm_oec_consume_mode"] == "CANDIDATE_ONLY"
    assert obs["allow_confirm_dispatch"] is False
    assert obs["allow_oec_dispatch"] is False
    assert obs["confirm_token_minted"] is False
    assert obs["oec_dispatch_invoked"] is False
    assert obs["erp_command_posted"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    eco = (dto.metadata or {}).get("explicit_confirmation_oec_dispatch") or {}
    assert eco.get("confirm_oec_consume_mode") == "CANDIDATE_ONLY"
    assert eco.get("confirm_oec_consume_ready") is True
    assert eco.get("confirm_token_minted") is False
    assert eco.get("oec_dispatch_invoked") is False
    assert eco.get("gap_p0_001_status") == "OPEN"
    assert eco.get("allow_confirm_dispatch") is False
    assert eco.get("allow_oec_dispatch") is False
    assert eco.get("is_execution_authority") is False
    cand = eco.get("confirm_oec_candidate") or {}
    assert cand.get("draft_module_id") == "purchase_draft"
    assert cand.get("confirm_token") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai34"
        / "frozen"
        / "confirm_oec_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_confirm_oec_consume_mode(
                case["synthetic_meta"],
                allow_confirm_dispatch=bool(
                    case.get("allow_confirm_dispatch", False)
                ),
                allow_oec_dispatch=bool(case.get("allow_oec_dispatch", False)),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_confirm_oec_consume_mode(
                req.explicit_confirmation_oec_dispatch_bundle,
                allow_confirm_dispatch=bool(
                    case.get("allow_confirm_dispatch", False)
                ),
                allow_oec_dispatch=bool(case.get("allow_oec_dispatch", False)),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
