"""MAI-32 durable versioned drafts — readiness / policy annotation (never writes)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class DurableVersionedDraftStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class DraftDurabilityStatus(str, Enum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    EPHEMERAL_LOCAL_JSON = "EPHEMERAL_LOCAL_JSON"
    NOT_PRODUCTION_AUTHORITY = "NOT_PRODUCTION_AUTHORITY"
    AGGREGATE_PENDING = "AGGREGATE_PENDING"


class DraftVersionPolicy(str, Enum):
    MONOTONIC_INT_BUMP = "MONOTONIC_INT_BUMP"
    UNKNOWN = "UNKNOWN"


class DraftConcurrencyPolicy(str, Enum):
    OPTIMISTIC_EXPECTED_VERSION = "OPTIMISTIC_EXPECTED_VERSION"
    UNKNOWN = "UNKNOWN"


class DurableVersionedDraftBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: DurableVersionedDraftStatus = DurableVersionedDraftStatus.NOT_RUN
    runtime_version: str = "mai-32.0.2-slice2"
    source_authority: str = "REQUEST"
    selected_port_id: str | None = None
    selected_draft_entrypoint: str | None = None
    event_type: str = "unknown"
    draft_module_id: str | None = None
    version_policy: DraftVersionPolicy = DraftVersionPolicy.MONOTONIC_INT_BUMP
    concurrency_policy: DraftConcurrencyPolicy = (
        DraftConcurrencyPolicy.OPTIMISTIC_EXPECTED_VERSION
    )
    version_field_name: str = "version"
    requires_expected_version_on_write: bool = True
    stale_write_outcome: str = "CONFLICT"
    cross_company_access: str = "DENY"
    tenant_isolation_required: bool = True
    durability_status: DraftDurabilityStatus = DraftDurabilityStatus.NOT_APPLICABLE
    production_store_authority: bool = False
    local_json_is_production_authority: bool = False
    dexie_is_calc_authority_on_confirm: bool = True
    draft_aggregate_ready: bool = False
    store_backend: str = "LOCAL_JSON_SESSION"
    store_root_env: str = "ORBIX_DRAFT_STORE_DIR"
    store_root_resolved: str | None = None
    store_root_present: bool = False
    store_file_present: bool = False
    store_ready_for_annotation: bool = False
    store_ready_for_production: bool = False
    known_store_filename: str | None = None
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    draft_mutations: int = Field(ge=0, default=0)
    save_invoked: bool = False
    load_invoked: bool = False
    start_or_merge_invoked: bool = False
    mode_aware_invoked: bool = False
    dexie_invoked: bool = False
    orbix_drafts_api_invoked: bool = False
    aggregate_written: bool = False

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @field_validator("source_authority")
    @classmethod
    def _src(cls, v: str) -> str:
        if v != "REQUEST":
            raise ValueError("SOURCE_AUTHORITY_MUST_BE_REQUEST")
        return v

    @field_validator(
        "production_store_authority",
        "local_json_is_production_authority",
        "store_ready_for_production",
        "draft_aggregate_ready",
        "save_invoked",
        "load_invoked",
        "start_or_merge_invoked",
        "mode_aware_invoked",
        "dexie_invoked",
        "orbix_drafts_api_invoked",
        "aggregate_written",
    )
    @classmethod
    def _never_write_or_claim_prod(cls, v: bool) -> bool:
        if v:
            raise ValueError("DURABLE_DRAFT_MUST_NOT_WRITE_OR_CLAIM_PROD")
        return v

    @field_validator("draft_mutations")
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("DURABLE_DRAFT_MUST_NOT_MUTATE")
        return v

    @field_validator("stale_write_outcome")
    @classmethod
    def _stale(cls, v: str) -> str:
        if v != "CONFLICT":
            raise ValueError("STALE_WRITE_MUST_BE_CONFLICT")
        return v

    @field_validator("cross_company_access")
    @classmethod
    def _xco(cls, v: str) -> str:
        if v != "DENY":
            raise ValueError("CROSS_COMPANY_MUST_DENY")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
