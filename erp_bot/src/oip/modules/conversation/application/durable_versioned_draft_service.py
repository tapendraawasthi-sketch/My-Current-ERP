"""MAI-32 — durable versioned draft readiness annotation (never writes).

Slice 1: declare version/concurrency/durability policy + read-only store
path probe from MAI-31 domain-port mapping. Never save_*/load_*/start_or_merge,
mode_aware, Dexie, or DraftAggregate writes.
Slice 2: consume helpers build DraftAggregate candidates (CANDIDATE_ONLY);
still never save_* on the annotation path.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

from ....contracts.domain_port_mapping import (
    DomainPortMappingStatus,
    DomainPortSupportStatus,
)
from ....contracts.durable_versioned_draft import (
    DraftConcurrencyPolicy,
    DraftDurabilityStatus,
    DraftVersionPolicy,
    DurableVersionedDraftBundleV1,
    DurableVersionedDraftStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-32.0.2-slice2"
AUTHORITY = "ADR_0049"

# Annotation seed: port → khata module / store file / version field (not imported).
_MODULE_TABLE: dict[str, dict[str, str]] = {
    "purchase_draft_port": {
        "draft_module_id": "purchase_draft",
        "store_filename": "purchase_drafts.json",
        "version_field_name": "version",
    },
    "sales_draft_port": {
        "draft_module_id": "sales_draft",
        "store_filename": "sales_drafts.json",
        "version_field_name": "version",
    },
    "sales_return_draft_port": {
        "draft_module_id": "sales_return_draft",
        "store_filename": "sales_return_drafts.json",
        "version_field_name": "version",
    },
    "financial_draft_port": {
        "draft_module_id": "financial_draft",
        "store_filename": "financial_drafts.json",
        "version_field_name": "draft_version",
    },
}


def _resolve_store_root() -> tuple[str, bool]:
    env = (os.environ.get("ORBIX_DRAFT_STORE_DIR") or "").strip()
    if env:
        root = env
    else:
        root = os.path.join(tempfile.gettempdir(), "orbix_drafts")
    present = Path(root).exists()
    return root, present


def build_durable_versioned_draft_bundle(
    request: CanonicalAIRequestV1,
) -> DurableVersionedDraftBundleV1:
    mapping = request.domain_port_mapping_bundle
    if mapping is None:
        return DurableVersionedDraftBundleV1(
            analysis_status=DurableVersionedDraftStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            durability_status=DraftDurabilityStatus.NOT_APPLICABLE,
            reason_codes=("NO_DOMAIN_PORT_MAPPING",),
            warnings=("NO_DOMAIN_PORT_MAPPING",),
        )

    if mapping.analysis_status != DomainPortMappingStatus.COMPLETE:
        return DurableVersionedDraftBundleV1(
            analysis_status=DurableVersionedDraftStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=mapping.event_type or "unknown",
            durability_status=DraftDurabilityStatus.NOT_APPLICABLE,
            reason_codes=(
                "PORT_MAPPING_NOT_COMPLETE",
                "PORT_MAPPING_NOT_APPLICABLE",
            ),
            warnings=("PORT_MAPPING_NOT_APPLICABLE",),
        )

    event_type = mapping.event_type or "unknown"
    port_id = mapping.selected_port_id
    entrypoint = mapping.selected_draft_entrypoint
    support = mapping.support_status

    if support in {
        DomainPortSupportStatus.UNSUPPORTED,
        DomainPortSupportStatus.INCOMPLETE,
    }:
        return DurableVersionedDraftBundleV1(
            analysis_status=DurableVersionedDraftStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            selected_port_id=port_id,
            selected_draft_entrypoint=entrypoint,
            event_type=event_type,
            durability_status=DraftDurabilityStatus.AGGREGATE_PENDING,
            store_ready_for_annotation=False,
            reason_codes=(
                "PORT_NOT_READY_FOR_DURABLE_DRAFT",
                f"SUPPORT_{support.value}",
                "DRAFT_AGGREGATE_NOT_READY",
                "LOCAL_JSON_NOT_PRODUCTION_AUTHORITY",
                "NO_SAVE_INVOKED",
                "NO_DRAFT_MUTATIONS",
            ),
            warnings=("BLOCK_OR_CLARIFY_BEFORE_DURABLE_WRITE",),
        )

    if support != DomainPortSupportStatus.SUPPORTED or not port_id:
        return DurableVersionedDraftBundleV1(
            analysis_status=DurableVersionedDraftStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=event_type,
            durability_status=DraftDurabilityStatus.NOT_APPLICABLE,
            reason_codes=("PORT_MAPPING_NOT_APPLICABLE",),
            warnings=("PORT_MAPPING_NOT_APPLICABLE",),
        )

    row = _MODULE_TABLE.get(port_id)
    if row is None:
        return DurableVersionedDraftBundleV1(
            analysis_status=DurableVersionedDraftStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            selected_port_id=port_id,
            selected_draft_entrypoint=entrypoint,
            event_type=event_type,
            durability_status=DraftDurabilityStatus.AGGREGATE_PENDING,
            reason_codes=(
                "UNSUPPORTED_DRAFT_MODULE",
                "DRAFT_AGGREGATE_NOT_READY",
                "NO_SAVE_INVOKED",
            ),
            warnings=("UNSUPPORTED_DRAFT_MODULE",),
        )

    root, root_present = _resolve_store_root()
    filename = row["store_filename"]
    file_path = Path(root) / filename
    file_present = file_path.is_file()
    reasons: list[str] = [
        "PORT_SUPPORTED",
        "VERSION_POLICY_MONOTONIC_INT",
        "CONCURRENCY_OPTIMISTIC_EXPECTED_VERSION",
        "STALE_WRITE_CONFLICT_REQUIRED",
        "CROSS_COMPANY_DENY",
        "TENANT_ISOLATION_REQUIRED",
        "STORE_BACKEND_LOCAL_JSON_SESSION",
        "LOCAL_JSON_NOT_PRODUCTION_AUTHORITY",
        "DRAFT_AGGREGATE_NOT_READY",
        "DEXIE_REMAINS_CALC_ON_CONFIRM",
        "NO_SAVE_INVOKED",
        "NO_DRAFT_MUTATIONS",
        "PAYLOAD_CANDIDATE_ONLY",
    ]
    reasons.append("STORE_ROOT_PRESENT" if root_present else "STORE_ROOT_MISSING")
    reasons.append("STORE_FILE_PRESENT" if file_present else "STORE_FILE_MISSING")

    return DurableVersionedDraftBundleV1(
        analysis_status=DurableVersionedDraftStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        selected_port_id=port_id,
        selected_draft_entrypoint=entrypoint,
        event_type=event_type,
        draft_module_id=row["draft_module_id"],
        version_policy=DraftVersionPolicy.MONOTONIC_INT_BUMP,
        concurrency_policy=DraftConcurrencyPolicy.OPTIMISTIC_EXPECTED_VERSION,
        version_field_name=row["version_field_name"],
        durability_status=DraftDurabilityStatus.EPHEMERAL_LOCAL_JSON,
        store_backend="LOCAL_JSON_SESSION",
        store_root_resolved=root,
        store_root_present=root_present,
        store_file_present=file_present,
        store_ready_for_annotation=True,
        known_store_filename=filename,
        reason_codes=tuple(reasons),
        warnings=(
            "EPHEMERAL_LOCAL_JSON_NOT_PRODUCTION",
            "DRAFT_AGGREGATE_PENDING_LATER_SLICE",
        ),
    )


def attach_durable_versioned_draft_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_durable_versioned_draft_bundle(request)
    return request.model_copy(update={"durable_versioned_draft_bundle": bundle})


def assert_durable_versioned_draft_authority(
    bundle: DurableVersionedDraftBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.production_store_authority
        or bundle.local_json_is_production_authority
        or bundle.store_ready_for_production
        or bundle.draft_aggregate_ready
        or bundle.save_invoked
        or bundle.load_invoked
        or bundle.start_or_merge_invoked
        or bundle.mode_aware_invoked
        or bundle.dexie_invoked
        or bundle.orbix_drafts_api_invoked
        or bundle.aggregate_written
        or bundle.draft_mutations != 0
    ):
        raise RuntimeError("DURABLE_VERSIONED_DRAFT_AUTHORITY")


def durable_versioned_draft_to_metadata(
    bundle: DurableVersionedDraftBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "selected_port_id": bundle.selected_port_id,
        "selected_draft_entrypoint": bundle.selected_draft_entrypoint,
        "event_type": bundle.event_type,
        "draft_module_id": bundle.draft_module_id,
        "version_policy": bundle.version_policy.value,
        "concurrency_policy": bundle.concurrency_policy.value,
        "version_field_name": bundle.version_field_name,
        "durability_status": bundle.durability_status.value,
        "production_store_authority": False,
        "local_json_is_production_authority": False,
        "store_ready_for_production": False,
        "draft_aggregate_ready": False,
        "store_backend": bundle.store_backend,
        "store_root_present": bundle.store_root_present,
        "store_file_present": bundle.store_file_present,
        "store_ready_for_annotation": bundle.store_ready_for_annotation,
        "known_store_filename": bundle.known_store_filename,
        "draft_mutations": 0,
        "save_invoked": False,
        "load_invoked": False,
        "start_or_merge_invoked": False,
        "mode_aware_invoked": False,
        "dexie_invoked": False,
        "orbix_drafts_api_invoked": False,
        "aggregate_written": False,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
