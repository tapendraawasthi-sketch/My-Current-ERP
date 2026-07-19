"""MAI-32 slice 2 — consume durable-draft readiness into DraftAggregate candidates.

Default: CANDIDATE_ONLY (build aggregate write candidate; never call save_*).
Optional allow_durable_write is for isolated unit-test labeling only — live
ingress always forces false. Never Dexie, mode_aware, or journal math.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.durable_versioned_draft import (
    DraftDurabilityStatus,
    DurableVersionedDraftBundleV1,
    DurableVersionedDraftStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-32.0.2-slice2"
AUTHORITY = "ADR_0049"


def _as_dvd_meta(
    bundle: Mapping[str, Any] | DurableVersionedDraftBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, DurableVersionedDraftBundleV1):
        from .durable_versioned_draft_service import durable_versioned_draft_to_metadata

        return durable_versioned_draft_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("production_store_authority") is True
        or data.get("local_json_is_production_authority") is True
        or data.get("store_ready_for_production") is True
        or data.get("draft_aggregate_ready") is True
        or data.get("save_invoked") is True
        or data.get("load_invoked") is True
        or data.get("start_or_merge_invoked") is True
        or data.get("mode_aware_invoked") is True
        or data.get("dexie_invoked") is True
        or data.get("orbix_drafts_api_invoked") is True
        or data.get("aggregate_written") is True
        or int(data.get("draft_mutations") or 0) != 0
    )


def resolve_durable_draft_consume_mode(
    bundle: Mapping[str, Any] | DurableVersionedDraftBundleV1 | None,
    *,
    allow_durable_write: bool = False,
) -> str:
    """Return consume mode (never implies drafts written on default path)."""
    data = _as_dvd_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != DurableVersionedDraftStatus.COMPLETE.value:
        return "SKIP"
    durability = str(data.get("durability_status") or "")
    if durability == DraftDurabilityStatus.AGGREGATE_PENDING.value:
        return "BLOCKED"
    if durability == DraftDurabilityStatus.NOT_APPLICABLE.value:
        return "SKIP"
    if not data.get("store_ready_for_annotation"):
        return "BLOCKED"
    if not data.get("draft_module_id"):
        return "BLOCKED"
    if allow_durable_write:
        return "INVOKE_SAVE"
    return "CANDIDATE_ONLY"


def build_draft_aggregate_candidate(
    bundle: Mapping[str, Any] | DurableVersionedDraftBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_durable_write: bool = False,
) -> dict[str, Any]:
    """Build DraftAggregate write candidate (never persists)."""
    data = _as_dvd_meta(bundle)
    mode = resolve_durable_draft_consume_mode(
        data, allow_durable_write=allow_durable_write
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "durable_consume_mode": mode,
        "durable_consume_ready": False,
        "draft_aggregate_candidate": None,
        "save_invoked": False,
        "load_invoked": False,
        "draft_mutations": 0,
        "aggregate_written": False,
        "production_store_authority": False,
        "local_json_is_production_authority": False,
        "store_ready_for_production": False,
        "draft_aggregate_ready": False,
        "dexie_invoked": False,
        "mode_aware_invoked": False,
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_durable_write": False,
    }
    if data is None or mode in {"UNCHANGED", "SKIP", "BLOCKED"}:
        return base

    candidate = {
        "draft_module_id": data.get("draft_module_id"),
        "port_id": data.get("selected_port_id"),
        "entrypoint": data.get("selected_draft_entrypoint"),
        "event_type": data.get("event_type"),
        "store_filename": data.get("known_store_filename"),
        "store_backend": data.get("store_backend") or "LOCAL_JSON_SESSION",
        "version_field_name": data.get("version_field_name") or "version",
        "version_policy": data.get("version_policy"),
        "concurrency_policy": data.get("concurrency_policy"),
        "expected_version": None,  # new aggregate; optimistic token deferred
        "next_version": 1,
        "field_overrides": overrides,
        "tenant_isolation_required": True,
        "cross_company_access": "DENY",
        "stale_write_outcome": "CONFLICT",
        "production_store_authority": False,
        "local_json_is_production_authority": False,
        "dexie_is_calc_authority_on_confirm": True,
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["draft_module_id"])
    base.update(
        {
            "durable_consume_ready": ready,
            "draft_aggregate_candidate": candidate,
        }
    )
    return base


def durable_draft_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_durable_write: bool = False,
) -> dict[str, Any]:
    """Merge durable consume observability; pull MAI-31 field_overrides when present."""
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

    built = build_draft_aggregate_candidate(
        request.durable_versioned_draft_bundle,
        field_overrides=overrides,
        allow_durable_write=False,  # live path force
    )
    return {
        "durable_consume_mode": built["durable_consume_mode"],
        "durable_consume_ready": bool(built["durable_consume_ready"]),
        "draft_aggregate_candidate": built.get("draft_aggregate_candidate"),
        "save_invoked": False,
        "load_invoked": False,
        "draft_mutations": 0,
        "aggregate_written": False,
        "production_store_authority": False,
        "local_json_is_production_authority": False,
        "store_ready_for_production": False,
        "draft_aggregate_ready": False,
        "dexie_invoked": False,
        "mode_aware_invoked": False,
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_durable_write": False,
    }


def assert_durable_draft_consume_authority(obs: Mapping[str, Any] | None) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("save_invoked") is True
        or obs.get("load_invoked") is True
        or obs.get("aggregate_written") is True
        or obs.get("production_store_authority") is True
        or obs.get("local_json_is_production_authority") is True
        or obs.get("store_ready_for_production") is True
        or obs.get("draft_aggregate_ready") is True
        or obs.get("dexie_invoked") is True
        or obs.get("mode_aware_invoked") is True
        or int(obs.get("draft_mutations") or 0) != 0
        or obs.get("allow_durable_write") is True
    ):
        raise RuntimeError("DURABLE_DRAFT_CONSUME_AUTHORITY")


def enrich_dvd_metadata_with_consume(
    dvd_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(dvd_meta)
    obs = durable_draft_consume_observability(request, allow_durable_write=False)
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
