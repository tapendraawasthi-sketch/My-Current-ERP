"""MAI-34 — explicit confirmation / OEC dispatch policy annotation (never posts).

Slice 1: declare confirm policy, stale-preview reject, and OEC readiness from
MAI-33 preview state. Never mint tokens, Action/OEC dispatch, or Dexie posts.
"""

from __future__ import annotations

from typing import Any

from ....contracts.deterministic_preview_edit_loop import (
    DeterministicPreviewEditLoopStatus,
    PreviewReadiness,
)
from ....contracts.explicit_confirmation_oec_dispatch import (
    ActionToOecStatus,
    ConfirmPolicy,
    ConfirmReadiness,
    ExplicitConfirmationOecDispatchBundleV1,
    ExplicitConfirmationOecDispatchStatus,
    OecDispatchReadiness,
    ProductMutationPath,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-34.0.2-slice2"
AUTHORITY = "ADR_0051"


def build_explicit_confirmation_oec_dispatch_bundle(
    request: CanonicalAIRequestV1,
) -> ExplicitConfirmationOecDispatchBundleV1:
    pel = request.deterministic_preview_edit_loop_bundle
    if pel is None:
        return ExplicitConfirmationOecDispatchBundleV1(
            analysis_status=ExplicitConfirmationOecDispatchStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            confirm_readiness=ConfirmReadiness.NOT_APPLICABLE,
            oec_dispatch_readiness=OecDispatchReadiness.NOT_APPLICABLE,
            reason_codes=("NO_DETERMINISTIC_PREVIEW_EDIT_LOOP",),
            warnings=("NO_DETERMINISTIC_PREVIEW_EDIT_LOOP",),
        )

    if pel.analysis_status != DeterministicPreviewEditLoopStatus.COMPLETE:
        return ExplicitConfirmationOecDispatchBundleV1(
            analysis_status=ExplicitConfirmationOecDispatchStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=pel.event_type or "unknown",
            confirm_readiness=ConfirmReadiness.NOT_APPLICABLE,
            oec_dispatch_readiness=OecDispatchReadiness.NOT_APPLICABLE,
            reason_codes=(
                "PREVIEW_EDIT_LOOP_NOT_COMPLETE",
                "CONFIRM_NOT_APPLICABLE",
            ),
            warnings=("CONFIRM_NOT_APPLICABLE",),
        )

    event_type = pel.event_type or "unknown"
    port_id = pel.selected_port_id
    module_id = pel.draft_module_id

    if pel.preview_readiness == PreviewReadiness.BLOCKED:
        return ExplicitConfirmationOecDispatchBundleV1(
            analysis_status=ExplicitConfirmationOecDispatchStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            selected_port_id=port_id,
            draft_module_id=module_id,
            event_type=event_type,
            confirm_readiness=ConfirmReadiness.BLOCKED,
            oec_dispatch_readiness=OecDispatchReadiness.BLOCKED,
            confirm_policy=ConfirmPolicy.NOT_APPLICABLE,
            product_mutation_path=ProductMutationPath.DEXIE_EXECUTE_ORBIX_CONFIRM,
            action_to_oec_status=ActionToOecStatus.NOT_PRODUCT_PATH,
            reason_codes=(
                "PREVIEW_BLOCKED_UNTIL_READY",
                "CONFIRM_BLOCKED",
                "OEC_DISPATCH_BLOCKED",
                "NO_CONFIRM_TOKEN_MINTED",
                "NO_OEC_DISPATCH",
                "GAP_P0_001_OPEN",
            ),
            warnings=(
                "GAP_P0_001_REMAINS_OPEN",
                "CONFIRM_TOKEN_PENDING_LATER_SLICE",
            ),
        )

    if pel.preview_readiness != PreviewReadiness.POLICY_DECLARED or not module_id:
        return ExplicitConfirmationOecDispatchBundleV1(
            analysis_status=ExplicitConfirmationOecDispatchStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=event_type,
            confirm_readiness=ConfirmReadiness.NOT_APPLICABLE,
            oec_dispatch_readiness=OecDispatchReadiness.NOT_APPLICABLE,
            reason_codes=("CONFIRM_NOT_APPLICABLE",),
            warnings=("CONFIRM_NOT_APPLICABLE",),
        )

    reasons = (
        "PORT_SUPPORTED",
        "CONFIRM_POLICY_DECLARED",
        "EXPLICIT_UI_CONFIRM_REQUIRED",
        "NL_ASSENT_MUST_NOT_POST",
        "STALE_PREVIEW_HASH_MUST_REJECT",
        "PREVIEW_HASH_REQUIRED_ON_CONFIRM",
        "DRAFT_VERSION_BOUND_ON_CONFIRM",
        "CONFIRM_TOKEN_NOT_ISSUED",
        "REVALIDATION_REQUIRED_BEFORE_DISPATCH",
        "OEC_DISPATCH_POLICY_DECLARED",
        "ACTION_TO_OEC_NOT_PRODUCT_PATH",
        "PRODUCT_PATH_IS_DEXIE_EXECUTE_ORBIX_CONFIRM",
        "GAP_P0_001_OPEN",
        "IDEMPOTENCY_KEY_REQUIRED_ON_DISPATCH",
        "NO_CONFIRM_TOKEN_MINTED",
        "NO_OEC_DISPATCH",
        "NO_ACTION_RUNTIME_INVOKE",
        "NO_ERP_POST",
        "CROSS_COMPANY_DENY",
        "TENANT_ISOLATION_REQUIRED",
    )
    return ExplicitConfirmationOecDispatchBundleV1(
        analysis_status=ExplicitConfirmationOecDispatchStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        selected_port_id=port_id,
        draft_module_id=module_id,
        event_type=event_type,
        confirm_readiness=ConfirmReadiness.POLICY_DECLARED,
        oec_dispatch_readiness=OecDispatchReadiness.POLICY_DECLARED,
        confirm_policy=ConfirmPolicy.EXPLICIT_UI_CONFIRM_REQUIRED,
        product_mutation_path=ProductMutationPath.DEXIE_EXECUTE_ORBIX_CONFIRM,
        action_to_oec_status=ActionToOecStatus.NOT_PRODUCT_PATH,
        calc_authority_on_confirm="DEXIE_DOMAIN_ENGINE",
        reason_codes=reasons,
        warnings=(
            "GAP_P0_001_REMAINS_OPEN",
            "LEGACY_DEXIE_CONFIRM_STILL_ACTIVE_AUTHORITATIVE",
            "OEC_DISPATCH_PENDING_LATER_SLICE",
            "CONFIRM_TOKEN_PENDING_LATER_SLICE",
        ),
    )


def attach_explicit_confirmation_oec_dispatch_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_explicit_confirmation_oec_dispatch_bundle(request)
    return request.model_copy(
        update={"explicit_confirmation_oec_dispatch_bundle": bundle}
    )


def assert_explicit_confirmation_oec_dispatch_authority(
    bundle: ExplicitConfirmationOecDispatchBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.nl_assent_posts
        or bundle.confirm_token_minted
        or bundle.confirm_accepted
        or bundle.nl_yes_treated_as_confirm
        or bundle.revalidation_executed
        or bundle.action_runtime_invoked
        or bundle.oec_dispatch_invoked
        or bundle.dispatch_envelope_built
        or bundle.erp_command_posted
        or bundle.dexie_post_invoked
        or bundle.khata_confirm_invoked
        or bundle.mode_aware_invoked
        or bundle.receipt_returned
        or bundle.draft_mutations != 0
        or bundle.posting_mutations != 0
        or bundle.gap_p0_001_status != "OPEN"
        or bundle.confirm_token_status != "NOT_ISSUED"
    ):
        raise RuntimeError("EXPLICIT_CONFIRMATION_OEC_DISPATCH_AUTHORITY")


def explicit_confirmation_oec_dispatch_to_metadata(
    bundle: ExplicitConfirmationOecDispatchBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "selected_port_id": bundle.selected_port_id,
        "draft_module_id": bundle.draft_module_id,
        "event_type": bundle.event_type,
        "confirm_readiness": bundle.confirm_readiness.value,
        "oec_dispatch_readiness": bundle.oec_dispatch_readiness.value,
        "confirm_policy": bundle.confirm_policy.value,
        "confirm_token_status": "NOT_ISSUED",
        "product_mutation_path": bundle.product_mutation_path.value,
        "action_to_oec_status": bundle.action_to_oec_status.value,
        "stale_preview_on_confirm": "REJECT",
        "nl_assent_posts": False,
        "gap_p0_001_status": "OPEN",
        "confirm_token_minted": False,
        "confirm_accepted": False,
        "oec_dispatch_invoked": False,
        "action_runtime_invoked": False,
        "erp_command_posted": False,
        "dexie_post_invoked": False,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
