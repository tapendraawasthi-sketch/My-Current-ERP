"""MAI-35 offline / sync / conflict / reversal — policy annotation (never syncs)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class OfflineSyncConflictReversalStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class SyncPolicyReadiness(str, Enum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    POLICY_DECLARED = "POLICY_DECLARED"
    BLOCKED = "BLOCKED"


class ConflictPolicy(str, Enum):
    REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT = (
        "REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT"
    )
    NOT_APPLICABLE = "NOT_APPLICABLE"


class ReversalPolicy(str, Enum):
    GOVERNED_CORRECTION_ONLY = "GOVERNED_CORRECTION_ONLY"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class DualSyncStatus(str, Enum):
    OPEN = "OPEN"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class OfflineSyncConflictReversalBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: OfflineSyncConflictReversalStatus = (
        OfflineSyncConflictReversalStatus.NOT_RUN
    )
    runtime_version: str = "mai-35.0.2-slice2"
    source_authority: str = "REQUEST"
    selected_port_id: str | None = None
    draft_module_id: str | None = None
    event_type: str = "unknown"
    sync_policy_readiness: SyncPolicyReadiness = SyncPolicyReadiness.NOT_APPLICABLE
    lifecycle_states_declared: tuple[str, ...] = ()
    queueable_class_policy: str = "DECLARED_NOT_ENFORCED"
    online_only_class_policy: str = "DECLARED_NOT_ENFORCED"
    conflict_policy: ConflictPolicy = ConflictPolicy.NOT_APPLICABLE
    reversal_policy: ReversalPolicy = ReversalPolicy.NOT_APPLICABLE
    queued_must_not_label_synced: bool = True
    retry_must_be_idempotent: bool = True
    posted_history_immutable_except_governed_reversal: bool = True
    dual_sync_status: DualSyncStatus = DualSyncStatus.NOT_APPLICABLE
    gap_p1_002_status: str = "OPEN"
    gap_p0_001_status: str = "OPEN"
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    sync_workers_started: bool = False
    sync_push_invoked: bool = False
    sync_pull_invoked: bool = False
    queue_enqueued: bool = False
    conflict_resolved: bool = False
    conflict_auto_overwrite: bool = False
    reversal_dispatched: bool = False
    posted_history_edited: bool = False
    ui_badge_mutated: bool = False
    queued_labeled_synced: bool = False
    queue_mutations: int = Field(ge=0, default=0)
    sync_mutations: int = Field(ge=0, default=0)
    reversal_mutations: int = Field(ge=0, default=0)

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

    @field_validator("queued_must_not_label_synced")
    @classmethod
    def _queued(cls, v: bool) -> bool:
        if not v:
            raise ValueError("QUEUED_MUST_NOT_LABEL_SYNCED")
        return v

    @field_validator("retry_must_be_idempotent")
    @classmethod
    def _retry(cls, v: bool) -> bool:
        if not v:
            raise ValueError("RETRY_MUST_BE_IDEMPOTENT")
        return v

    @field_validator("posted_history_immutable_except_governed_reversal")
    @classmethod
    def _hist(cls, v: bool) -> bool:
        if not v:
            raise ValueError("POSTED_HISTORY_MUST_STAY_IMMUTABLE")
        return v

    @field_validator("gap_p1_002_status")
    @classmethod
    def _gap1(cls, v: str) -> str:
        if v != "OPEN":
            raise ValueError("GAP_P1_002_MUST_REMAIN_OPEN")
        return v

    @field_validator("gap_p0_001_status")
    @classmethod
    def _gap0(cls, v: str) -> str:
        if v != "OPEN":
            raise ValueError("GAP_P0_001_MUST_REMAIN_OPEN")
        return v

    @field_validator(
        "sync_workers_started",
        "sync_push_invoked",
        "sync_pull_invoked",
        "queue_enqueued",
        "conflict_resolved",
        "conflict_auto_overwrite",
        "reversal_dispatched",
        "posted_history_edited",
        "ui_badge_mutated",
        "queued_labeled_synced",
    )
    @classmethod
    def _never_execute(cls, v: bool) -> bool:
        if v:
            raise ValueError("OFFLINE_SYNC_MUST_NOT_EXECUTE")
        return v

    @field_validator("queue_mutations", "sync_mutations", "reversal_mutations")
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("OFFLINE_SYNC_MUST_NOT_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
