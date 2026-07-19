"""MAI-34 slice 1 — explicit confirm / OEC dispatch policy (never posts)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.explicit_confirmation_oec_dispatch import (
    ConfirmPolicy,
    ConfirmReadiness,
    ExplicitConfirmationOecDispatchStatus,
    OecDispatchReadiness,
    ProductMutationPath,
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
    RUNTIME_VERSION,
    assert_explicit_confirmation_oec_dispatch_authority,
    attach_explicit_confirmation_oec_dispatch_to_request,
    build_explicit_confirmation_oec_dispatch_bundle,
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


def test_runtime_version() -> None:
    # Slice 2 bumps the shared runtime constant; slice-1 contracts still hold.
    assert RUNTIME_VERSION.startswith("mai-34.")


def test_purchase_policy_declared() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.explicit_confirmation_oec_dispatch_bundle
    assert bundle is not None
    assert bundle.analysis_status == ExplicitConfirmationOecDispatchStatus.COMPLETE
    assert bundle.confirm_readiness == ConfirmReadiness.POLICY_DECLARED
    assert bundle.oec_dispatch_readiness == OecDispatchReadiness.POLICY_DECLARED
    assert bundle.confirm_policy == ConfirmPolicy.EXPLICIT_UI_CONFIRM_REQUIRED
    assert bundle.product_mutation_path == (
        ProductMutationPath.DEXIE_EXECUTE_ORBIX_CONFIRM
    )
    assert bundle.nl_assent_posts is False
    assert bundle.stale_preview_on_confirm == "REJECT"
    assert bundle.gap_p0_001_status == "OPEN"
    assert bundle.confirm_token_status == "NOT_ISSUED"
    assert bundle.confirm_token_minted is False
    assert bundle.oec_dispatch_invoked is False
    assert bundle.erp_command_posted is False
    assert bundle.dexie_post_invoked is False
    assert bundle.posting_mutations == 0
    assert bundle.is_execution_authority is False
    assert "EXPLICIT_UI_CONFIRM_REQUIRED" in bundle.reason_codes
    assert "GAP_P0_001_OPEN" in bundle.reason_codes
    assert_explicit_confirmation_oec_dispatch_authority(bundle)


def test_report_skips() -> None:
    req = _pipeline("show balance sheet")
    bundle = req.explicit_confirmation_oec_dispatch_bundle
    assert bundle is not None
    assert bundle.analysis_status == ExplicitConfirmationOecDispatchStatus.SKIP
    assert bundle.confirm_token_minted is False
    assert bundle.oec_dispatch_invoked is False


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.explicit_confirmation_oec_dispatch_bundle
    assert bundle is not None
    assert bundle.analysis_status == ExplicitConfirmationOecDispatchStatus.SKIP


def test_no_preview_skips() -> None:
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
    bundle = build_explicit_confirmation_oec_dispatch_bundle(req)
    assert bundle.analysis_status == ExplicitConfirmationOecDispatchStatus.SKIP
    assert "NO_DETERMINISTIC_PREVIEW_EDIT_LOOP" in bundle.reason_codes


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    eco = (dto.metadata or {}).get("explicit_confirmation_oec_dispatch") or {}
    assert eco.get("nl_assent_posts") is False
    assert eco.get("confirm_token_minted") is False
    assert eco.get("oec_dispatch_invoked") is False
    assert eco.get("erp_command_posted") is False
    assert eco.get("gap_p0_001_status") == "OPEN"
    assert eco.get("is_execution_authority") is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai34"
        / "frozen"
        / "explicit_confirmation_oec_dispatch_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.explicit_confirmation_oec_dispatch_bundle
        assert bundle is not None
        assert bundle.nl_assent_posts is False
        assert bundle.confirm_token_minted is False
        assert bundle.oec_dispatch_invoked is False
        assert bundle.erp_command_posted is False
        assert bundle.gap_p0_001_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_confirm_readiness"):
            assert (
                bundle.confirm_readiness.value == case["expected_confirm_readiness"]
            ), case["case_id"]
        if case.get("expected_oec_readiness"):
            assert (
                bundle.oec_dispatch_readiness.value == case["expected_oec_readiness"]
            ), case["case_id"]
