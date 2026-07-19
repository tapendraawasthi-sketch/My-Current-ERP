"""MAI-33 slice 2 — consume preview/edit-loop policy into preview candidates.

Default: CANDIDATE_ONLY (build preview candidate; never preview_message/cards).
Optional allow_preview_generate is for unit-test labeling only — live ingress
always forces false. Never journal math, Dexie, or draft mutations.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.deterministic_preview_edit_loop import (
    DeterministicPreviewEditLoopBundleV1,
    DeterministicPreviewEditLoopStatus,
    PreviewReadiness,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-33.0.2-slice2"
AUTHORITY = "ADR_0050"


def _as_pel_meta(
    bundle: Mapping[str, Any] | DeterministicPreviewEditLoopBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, DeterministicPreviewEditLoopBundleV1):
        from .deterministic_preview_edit_loop_service import (
            deterministic_preview_edit_loop_to_metadata,
        )

        return deterministic_preview_edit_loop_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("preview_generated") is True
        or data.get("confirmation_card_generated") is True
        or data.get("preview_message_invoked") is True
        or data.get("preview_hash_minted") is True
        or data.get("preview_payload_ready") is True
        or data.get("server_preview_service_executed") is True
        or data.get("ui_calculates_authoritative_totals") is True
        or data.get("ai_journal_math_allowed") is True
        or data.get("journal_calculated") is True
        or data.get("save_invoked") is True
        or data.get("mode_aware_invoked") is True
        or int(data.get("draft_mutations") or 0) != 0
        or int(data.get("edit_mutations") or 0) != 0
        or str(data.get("gap_p2_002_status") or "OPEN") != "OPEN"
    )


def resolve_preview_consume_mode(
    bundle: Mapping[str, Any] | DeterministicPreviewEditLoopBundleV1 | None,
    *,
    allow_preview_generate: bool = False,
) -> str:
    """Return consume mode (never implies cards generated on default path)."""
    data = _as_pel_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != DeterministicPreviewEditLoopStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(data.get("preview_readiness") or "")
    if readiness == PreviewReadiness.BLOCKED.value:
        return "BLOCKED"
    if readiness == PreviewReadiness.NOT_APPLICABLE.value:
        return "SKIP"
    if readiness not in {
        PreviewReadiness.POLICY_DECLARED.value,
        PreviewReadiness.PENDING_ENGINE.value,
    }:
        return "SKIP"
    if not data.get("draft_module_id"):
        return "BLOCKED"
    if allow_preview_generate:
        return "INVOKE_PREVIEW_MESSAGE"
    return "CANDIDATE_ONLY"


def build_preview_candidate(
    bundle: Mapping[str, Any] | DeterministicPreviewEditLoopBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_preview_generate: bool = False,
) -> dict[str, Any]:
    """Build preview candidate (never generates cards or mints preview_hash)."""
    data = _as_pel_meta(bundle)
    mode = resolve_preview_consume_mode(
        data, allow_preview_generate=allow_preview_generate
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "preview_consume_mode": mode,
        "preview_consume_ready": False,
        "preview_candidate": None,
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
        "gap_p2_002_status": "OPEN",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_preview_generate": False,
    }
    if data is None or mode in {"UNCHANGED", "SKIP", "BLOCKED"}:
        return base

    candidate = {
        "draft_module_id": data.get("draft_module_id"),
        "port_id": data.get("selected_port_id"),
        "event_type": data.get("event_type"),
        "edit_loop_policy": data.get("edit_loop_policy"),
        "version_bump_on_edit": True,
        "stale_preview_on_confirm": "REJECT",
        "preview_bound_to_draft_version": True,
        "calc_authority_on_confirm": data.get("calc_authority_on_confirm")
        or "DEXIE_DOMAIN_ENGINE",
        "preview_contract_shape": "PREVIEW_V1_EFFECTS",
        "legacy_preview_path": "KHATA_PREVIEW_MESSAGE_AND_CARD",
        "preview_hash": None,
        "effects": None,
        "field_overrides": overrides,
        "gap_p2_002_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["draft_module_id"])
    base.update(
        {
            "preview_consume_ready": ready,
            "preview_candidate": candidate,
        }
    )
    return base


def preview_edit_loop_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_preview_generate: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; pull MAI-31 field_overrides when present."""
    overrides: dict[str, Any] = {}
    try:
        from .domain_port_consume_service import build_draft_payload_candidate

        payload = build_draft_payload_candidate(
            request.domain_port_mapping_bundle,
            request.event_frame,
            allow_port_invoke=False,
        )
        if isinstance(payload.get("field_overrides"), dict):
            overrides = dict(payload["field_overrides"])
    except Exception:  # noqa: BLE001
        overrides = {}

    built = build_preview_candidate(
        request.deterministic_preview_edit_loop_bundle,
        field_overrides=overrides,
        allow_preview_generate=False,  # live path force
    )
    return {
        "preview_consume_mode": built["preview_consume_mode"],
        "preview_consume_ready": bool(built["preview_consume_ready"]),
        "preview_candidate": built.get("preview_candidate"),
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
        "gap_p2_002_status": "OPEN",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_preview_generate": False,
    }


def assert_preview_edit_loop_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("preview_generated") is True
        or obs.get("confirmation_card_generated") is True
        or obs.get("preview_message_invoked") is True
        or obs.get("preview_hash_minted") is True
        or obs.get("preview_payload_ready") is True
        or obs.get("journal_calculated") is True
        or obs.get("ui_calculates_authoritative_totals") is True
        or obs.get("ai_journal_math_allowed") is True
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("edit_mutations") or 0) != 0
        or obs.get("allow_preview_generate") is True
        or str(obs.get("gap_p2_002_status") or "OPEN") != "OPEN"
    ):
        raise RuntimeError("PREVIEW_EDIT_LOOP_CONSUME_AUTHORITY")


def enrich_pel_metadata_with_consume(
    pel_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(pel_meta)
    obs = preview_edit_loop_consume_observability(
        request, allow_preview_generate=False
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
