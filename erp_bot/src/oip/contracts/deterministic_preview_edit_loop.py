"""MAI-33 deterministic preview / edit loop — policy annotation (never generates)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class DeterministicPreviewEditLoopStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class PreviewReadiness(str, Enum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    POLICY_DECLARED = "POLICY_DECLARED"
    BLOCKED = "BLOCKED"
    PENDING_ENGINE = "PENDING_ENGINE"


class EditLoopPolicy(str, Enum):
    INVALIDATE_PREVIEW_ON_EDIT = "INVALIDATE_PREVIEW_ON_EDIT"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class CalcAuthorityOnConfirm(str, Enum):
    DEXIE_DOMAIN_ENGINE = "DEXIE_DOMAIN_ENGINE"
    UNKNOWN = "UNKNOWN"


class DeterministicPreviewEditLoopBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: DeterministicPreviewEditLoopStatus = (
        DeterministicPreviewEditLoopStatus.NOT_RUN
    )
    runtime_version: str = "mai-33.0.1-slice1"
    source_authority: str = "REQUEST"
    selected_port_id: str | None = None
    draft_module_id: str | None = None
    event_type: str = "unknown"
    preview_readiness: PreviewReadiness = PreviewReadiness.NOT_APPLICABLE
    preview_contract_shape: str = "PREVIEW_V1_EFFECTS"
    legacy_preview_path: str = "KHATA_PREVIEW_MESSAGE_AND_CARD"
    edit_loop_policy: EditLoopPolicy = EditLoopPolicy.NOT_APPLICABLE
    version_bump_on_edit: bool = True
    stale_preview_on_confirm: str = "REJECT"
    preview_bound_to_draft_version: bool = True
    calc_authority_on_confirm: CalcAuthorityOnConfirm = (
        CalcAuthorityOnConfirm.DEXIE_DOMAIN_ENGINE
    )
    khata_preview_helpers_are_display_path: bool = True
    gap_p2_002_status: str = "OPEN"
    preview_compute_locus_candidates: tuple[str, ...] = (
        "DEXIE_DOMAIN_ENGINE",
        "SERVER_PREVIEW_SERVICE_PENDING",
    )
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    preview_generated: bool = False
    confirmation_card_generated: bool = False
    preview_message_invoked: bool = False
    preview_hash_minted: bool = False
    preview_payload_ready: bool = False
    server_preview_service_executed: bool = False
    ui_calculates_authoritative_totals: bool = False
    ai_journal_math_allowed: bool = False
    journal_calculated: bool = False
    draft_mutations: int = Field(ge=0, default=0)
    edit_mutations: int = Field(ge=0, default=0)
    draft_version_bumped: bool = False
    prior_preview_invalidated: bool = False
    save_invoked: bool = False
    mode_aware_invoked: bool = False

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

    @field_validator("stale_preview_on_confirm")
    @classmethod
    def _stale(cls, v: str) -> str:
        if v != "REJECT":
            raise ValueError("STALE_PREVIEW_MUST_REJECT")
        return v

    @field_validator("gap_p2_002_status")
    @classmethod
    def _gap(cls, v: str) -> str:
        if v != "OPEN":
            raise ValueError("GAP_P2_002_MUST_REMAIN_OPEN")
        return v

    @field_validator(
        "preview_generated",
        "confirmation_card_generated",
        "preview_message_invoked",
        "preview_hash_minted",
        "preview_payload_ready",
        "server_preview_service_executed",
        "ui_calculates_authoritative_totals",
        "ai_journal_math_allowed",
        "journal_calculated",
        "draft_version_bumped",
        "prior_preview_invalidated",
        "save_invoked",
        "mode_aware_invoked",
    )
    @classmethod
    def _never_execute(cls, v: bool) -> bool:
        if v:
            raise ValueError("PREVIEW_EDIT_LOOP_MUST_NOT_EXECUTE")
        return v

    @field_validator("draft_mutations", "edit_mutations")
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("PREVIEW_EDIT_LOOP_MUST_NOT_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
