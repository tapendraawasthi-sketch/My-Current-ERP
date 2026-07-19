"""MAI-33 — deterministic preview / edit-loop policy annotation (never generates).

Slice 1: declare preview readiness, edit→invalidate policy, and calc-ownership
flags from MAI-32 durable draft state. Never preview_message, confirmation
cards, journal math, or draft mutations.
"""

from __future__ import annotations

from typing import Any

from ....contracts.deterministic_preview_edit_loop import (
    CalcAuthorityOnConfirm,
    DeterministicPreviewEditLoopBundleV1,
    DeterministicPreviewEditLoopStatus,
    EditLoopPolicy,
    PreviewReadiness,
)
from ....contracts.durable_versioned_draft import (
    DraftDurabilityStatus,
    DurableVersionedDraftStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-33.0.1-slice1"
AUTHORITY = "ADR_0050"


def build_deterministic_preview_edit_loop_bundle(
    request: CanonicalAIRequestV1,
) -> DeterministicPreviewEditLoopBundleV1:
    dvd = request.durable_versioned_draft_bundle
    if dvd is None:
        return DeterministicPreviewEditLoopBundleV1(
            analysis_status=DeterministicPreviewEditLoopStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            preview_readiness=PreviewReadiness.NOT_APPLICABLE,
            reason_codes=("NO_DURABLE_VERSIONED_DRAFT",),
            warnings=("NO_DURABLE_VERSIONED_DRAFT",),
        )

    if dvd.analysis_status != DurableVersionedDraftStatus.COMPLETE:
        return DeterministicPreviewEditLoopBundleV1(
            analysis_status=DeterministicPreviewEditLoopStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=dvd.event_type or "unknown",
            preview_readiness=PreviewReadiness.NOT_APPLICABLE,
            reason_codes=(
                "DURABLE_DRAFT_NOT_COMPLETE",
                "DURABLE_DRAFT_NOT_APPLICABLE",
            ),
            warnings=("DURABLE_DRAFT_NOT_APPLICABLE",),
        )

    event_type = dvd.event_type or "unknown"
    port_id = dvd.selected_port_id
    module_id = dvd.draft_module_id

    if dvd.durability_status == DraftDurabilityStatus.AGGREGATE_PENDING:
        return DeterministicPreviewEditLoopBundleV1(
            analysis_status=DeterministicPreviewEditLoopStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            selected_port_id=port_id,
            draft_module_id=module_id,
            event_type=event_type,
            preview_readiness=PreviewReadiness.BLOCKED,
            edit_loop_policy=EditLoopPolicy.NOT_APPLICABLE,
            reason_codes=(
                "DURABLE_AGGREGATE_PENDING",
                "PREVIEW_BLOCKED_UNTIL_DRAFT_READY",
                "NO_PREVIEW_GENERATED",
                "NO_CONFIRMATION_CARD",
                "NO_DRAFT_MUTATIONS",
                "GAP_P2_002_OPEN",
            ),
            warnings=(
                "GAP_P2_002_REMAINS_OPEN",
                "ENGINE_PREVIEW_PENDING_LATER_SLICE",
            ),
        )

    if dvd.durability_status != DraftDurabilityStatus.EPHEMERAL_LOCAL_JSON:
        return DeterministicPreviewEditLoopBundleV1(
            analysis_status=DeterministicPreviewEditLoopStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=event_type,
            preview_readiness=PreviewReadiness.NOT_APPLICABLE,
            reason_codes=("DURABLE_DRAFT_NOT_APPLICABLE",),
            warnings=("DURABLE_DRAFT_NOT_APPLICABLE",),
        )

    if not module_id or not dvd.store_ready_for_annotation:
        return DeterministicPreviewEditLoopBundleV1(
            analysis_status=DeterministicPreviewEditLoopStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            selected_port_id=port_id,
            draft_module_id=module_id,
            event_type=event_type,
            preview_readiness=PreviewReadiness.BLOCKED,
            reason_codes=(
                "PREVIEW_BLOCKED_UNTIL_DRAFT_READY",
                "NO_PREVIEW_GENERATED",
                "GAP_P2_002_OPEN",
            ),
            warnings=("ENGINE_PREVIEW_PENDING_LATER_SLICE",),
        )

    reasons = (
        "PORT_SUPPORTED",
        "PREVIEW_POLICY_DECLARED",
        "EDIT_INVALIDATES_PREVIEW_HASH",
        "EDIT_BUMPS_DRAFT_VERSION",
        "STALE_PREVIEW_HASH_MUST_REJECT",
        "PREVIEW_BOUND_TO_DRAFT_VERSION",
        "UI_MUST_NOT_CALCULATE_AUTHORITATIVE_TOTALS",
        "AI_MUST_NOT_JOURNAL_MATH",
        "DEXIE_REMAINS_CALC_ON_CONFIRM",
        "GAP_P2_002_OPEN",
        "LEGACY_KHATA_PREVIEW_PATH_DOCUMENTED",
        "NO_PREVIEW_GENERATED",
        "NO_CONFIRMATION_CARD",
        "NO_PREVIEW_MESSAGE_INVOKED",
        "NO_JOURNAL_CALCULATED",
        "NO_DRAFT_MUTATIONS",
        "PREVIEW_PAYLOAD_PENDING_LATER_SLICE",
        "CROSS_COMPANY_DENY",
        "TENANT_ISOLATION_REQUIRED",
    )
    return DeterministicPreviewEditLoopBundleV1(
        analysis_status=DeterministicPreviewEditLoopStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        selected_port_id=port_id,
        draft_module_id=module_id,
        event_type=event_type,
        preview_readiness=PreviewReadiness.POLICY_DECLARED,
        edit_loop_policy=EditLoopPolicy.INVALIDATE_PREVIEW_ON_EDIT,
        version_bump_on_edit=True,
        stale_preview_on_confirm="REJECT",
        preview_bound_to_draft_version=True,
        calc_authority_on_confirm=CalcAuthorityOnConfirm.DEXIE_DOMAIN_ENGINE,
        khata_preview_helpers_are_display_path=True,
        gap_p2_002_status="OPEN",
        reason_codes=reasons,
        warnings=(
            "GAP_P2_002_REMAINS_OPEN",
            "LEGACY_PREVIEW_HELPERS_STILL_ACTIVE_AUTHORITATIVE",
            "ENGINE_PREVIEW_PENDING_LATER_SLICE",
            "CONFIRM_TOKEN_PENDING_MAI_34",
        ),
    )


def attach_deterministic_preview_edit_loop_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_deterministic_preview_edit_loop_bundle(request)
    return request.model_copy(
        update={"deterministic_preview_edit_loop_bundle": bundle}
    )


def assert_deterministic_preview_edit_loop_authority(
    bundle: DeterministicPreviewEditLoopBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.preview_generated
        or bundle.confirmation_card_generated
        or bundle.preview_message_invoked
        or bundle.preview_hash_minted
        or bundle.preview_payload_ready
        or bundle.server_preview_service_executed
        or bundle.ui_calculates_authoritative_totals
        or bundle.ai_journal_math_allowed
        or bundle.journal_calculated
        or bundle.draft_version_bumped
        or bundle.prior_preview_invalidated
        or bundle.save_invoked
        or bundle.mode_aware_invoked
        or bundle.draft_mutations != 0
        or bundle.edit_mutations != 0
        or bundle.gap_p2_002_status != "OPEN"
    ):
        raise RuntimeError("DETERMINISTIC_PREVIEW_EDIT_LOOP_AUTHORITY")


def deterministic_preview_edit_loop_to_metadata(
    bundle: DeterministicPreviewEditLoopBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "selected_port_id": bundle.selected_port_id,
        "draft_module_id": bundle.draft_module_id,
        "event_type": bundle.event_type,
        "preview_readiness": bundle.preview_readiness.value,
        "edit_loop_policy": bundle.edit_loop_policy.value,
        "version_bump_on_edit": True,
        "stale_preview_on_confirm": "REJECT",
        "preview_bound_to_draft_version": True,
        "calc_authority_on_confirm": bundle.calc_authority_on_confirm.value,
        "gap_p2_002_status": "OPEN",
        "preview_generated": False,
        "confirmation_card_generated": False,
        "preview_message_invoked": False,
        "preview_hash_minted": False,
        "preview_payload_ready": False,
        "journal_calculated": False,
        "ui_calculates_authoritative_totals": False,
        "ai_journal_math_allowed": False,
        "draft_mutations": 0,
        "edit_mutations": 0,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
