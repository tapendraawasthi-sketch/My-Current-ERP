"""MAI-34 slice 2 — consume confirm/OEC policy into candidates.

Default: CANDIDATE_ONLY (build confirm/OEC candidate; never mint/dispatch/post).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never Action/OEC dispatch, Dexie, khata, or Node confirm.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.explicit_confirmation_oec_dispatch import (
    ConfirmReadiness,
    ExplicitConfirmationOecDispatchBundleV1,
    ExplicitConfirmationOecDispatchStatus,
    OecDispatchReadiness,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-34.0.2-slice2"
AUTHORITY = "ADR_0051"


def _as_eco_meta(
    bundle: Mapping[str, Any] | ExplicitConfirmationOecDispatchBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, ExplicitConfirmationOecDispatchBundleV1):
        from .explicit_confirmation_oec_dispatch_service import (
            explicit_confirmation_oec_dispatch_to_metadata,
        )

        return explicit_confirmation_oec_dispatch_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("nl_assent_posts") is True
        or data.get("confirm_token_minted") is True
        or data.get("confirm_accepted") is True
        or data.get("nl_yes_treated_as_confirm") is True
        or data.get("revalidation_executed") is True
        or data.get("action_runtime_invoked") is True
        or data.get("oec_dispatch_invoked") is True
        or data.get("dispatch_envelope_built") is True
        or data.get("erp_command_posted") is True
        or data.get("dexie_post_invoked") is True
        or data.get("khata_confirm_invoked") is True
        or data.get("mode_aware_invoked") is True
        or data.get("receipt_returned") is True
        or int(data.get("draft_mutations") or 0) != 0
        or int(data.get("posting_mutations") or 0) != 0
        or str(data.get("gap_p0_001_status") or "OPEN") != "OPEN"
        or str(data.get("confirm_token_status") or "NOT_ISSUED") != "NOT_ISSUED"
    )


def resolve_confirm_oec_consume_mode(
    bundle: Mapping[str, Any] | ExplicitConfirmationOecDispatchBundleV1 | None,
    *,
    allow_confirm_dispatch: bool = False,
    allow_oec_dispatch: bool = False,
) -> str:
    """Return consume mode (never implies posts on default path)."""
    data = _as_eco_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != ExplicitConfirmationOecDispatchStatus.COMPLETE.value:
        return "SKIP"
    confirm_ready = str(data.get("confirm_readiness") or "")
    oec_ready = str(data.get("oec_dispatch_readiness") or "")
    if confirm_ready == ConfirmReadiness.BLOCKED.value or (
        oec_ready == OecDispatchReadiness.BLOCKED.value
    ):
        return "BLOCKED"
    if confirm_ready == ConfirmReadiness.NOT_APPLICABLE.value:
        return "SKIP"
    if confirm_ready not in {
        ConfirmReadiness.POLICY_DECLARED.value,
        ConfirmReadiness.PENDING_TOKEN.value,
    }:
        return "SKIP"
    if not data.get("draft_module_id"):
        return "BLOCKED"
    if allow_oec_dispatch:
        return "INVOKE_OEC_DISPATCH"
    if allow_confirm_dispatch:
        return "INVOKE_DEXIE_CONFIRM"
    return "CANDIDATE_ONLY"


def build_confirm_oec_candidate(
    bundle: Mapping[str, Any] | ExplicitConfirmationOecDispatchBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_confirm_dispatch: bool = False,
    allow_oec_dispatch: bool = False,
) -> dict[str, Any]:
    """Build confirm/OEC candidate (never mints tokens or posts)."""
    data = _as_eco_meta(bundle)
    mode = resolve_confirm_oec_consume_mode(
        data,
        allow_confirm_dispatch=allow_confirm_dispatch,
        allow_oec_dispatch=allow_oec_dispatch,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "confirm_oec_consume_mode": mode,
        "confirm_oec_consume_ready": False,
        "confirm_oec_candidate": None,
        "nl_assent_posts": False,
        "confirm_token_minted": False,
        "confirm_accepted": False,
        "oec_dispatch_invoked": False,
        "action_runtime_invoked": False,
        "erp_command_posted": False,
        "dexie_post_invoked": False,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "gap_p0_001_status": "OPEN",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_confirm_dispatch": False,
        "allow_oec_dispatch": False,
    }
    if data is None or mode in {"UNCHANGED", "SKIP", "BLOCKED"}:
        return base

    candidate = {
        "draft_module_id": data.get("draft_module_id"),
        "port_id": data.get("selected_port_id"),
        "event_type": data.get("event_type"),
        "confirm_policy": data.get("confirm_policy")
        or "EXPLICIT_UI_CONFIRM_REQUIRED",
        "confirm_token_status": "NOT_ISSUED",
        "confirm_token": None,
        "stale_preview_on_confirm": "REJECT",
        "preview_hash_required_on_confirm": True,
        "draft_version_bound": True,
        "nl_assent_posts": False,
        "revalidation_policy": "REQUIRED_BEFORE_DISPATCH",
        "product_mutation_path": data.get("product_mutation_path")
        or "DEXIE_EXECUTE_ORBIX_CONFIRM",
        "action_to_oec_status": data.get("action_to_oec_status")
        or "NOT_PRODUCT_PATH",
        "calc_authority_on_confirm": data.get("calc_authority_on_confirm")
        or "DEXIE_DOMAIN_ENGINE",
        "idempotency_policy": "KEY_REQUIRED_ON_DISPATCH",
        "receipt_contract": "RECEIPT_V1_PENDING",
        "oec_dispatch_envelope": None,
        "receipt": None,
        "field_overrides": overrides,
        "gap_p0_001_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["draft_module_id"])
    base.update(
        {
            "confirm_oec_consume_ready": ready,
            "confirm_oec_candidate": candidate,
        }
    )
    return base


def confirm_oec_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_confirm_dispatch: bool = False,
    allow_oec_dispatch: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; pull MAI-31 field_overrides when present."""
    del allow_confirm_dispatch, allow_oec_dispatch  # live path force below
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

    built = build_confirm_oec_candidate(
        request.explicit_confirmation_oec_dispatch_bundle,
        field_overrides=overrides,
        allow_confirm_dispatch=False,  # live path force
        allow_oec_dispatch=False,
    )
    return {
        "confirm_oec_consume_mode": built["confirm_oec_consume_mode"],
        "confirm_oec_consume_ready": bool(built["confirm_oec_consume_ready"]),
        "confirm_oec_candidate": built.get("confirm_oec_candidate"),
        "nl_assent_posts": False,
        "confirm_token_minted": False,
        "confirm_accepted": False,
        "oec_dispatch_invoked": False,
        "action_runtime_invoked": False,
        "erp_command_posted": False,
        "dexie_post_invoked": False,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "gap_p0_001_status": "OPEN",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_confirm_dispatch": False,
        "allow_oec_dispatch": False,
    }


def assert_confirm_oec_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("nl_assent_posts") is True
        or obs.get("confirm_token_minted") is True
        or obs.get("confirm_accepted") is True
        or obs.get("oec_dispatch_invoked") is True
        or obs.get("action_runtime_invoked") is True
        or obs.get("erp_command_posted") is True
        or obs.get("dexie_post_invoked") is True
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_confirm_dispatch") is True
        or obs.get("allow_oec_dispatch") is True
        or str(obs.get("gap_p0_001_status") or "OPEN") != "OPEN"
    ):
        raise RuntimeError("CONFIRM_OEC_CONSUME_AUTHORITY")


def enrich_eco_metadata_with_consume(
    eco_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(eco_meta)
    obs = confirm_oec_consume_observability(
        request,
        allow_confirm_dispatch=False,
        allow_oec_dispatch=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
