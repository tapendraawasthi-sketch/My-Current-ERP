"""MAI-12 language data catalog / training-eligibility contracts."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class LanguageDataRole(str, Enum):
    FROZEN_EVAL = "FROZEN_EVAL"
    DEVELOPMENT = "DEVELOPMENT"
    SEED_ONTOLOGY = "SEED_ONTOLOGY"
    RUNTIME_PACK = "RUNTIME_PACK"
    KB_INDEX = "KB_INDEX"
    SOURCE_ARCHIVE = "SOURCE_ARCHIVE"


class AssetPresence(str, Enum):
    PRESENT = "PRESENT"
    MISSING = "MISSING"
    HASH_MISMATCH = "HASH_MISMATCH"
    UNKNOWN = "UNKNOWN"


class LanguageDataGovernanceStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class LanguageDataAssetV1(ContractBase):
    asset_id: str
    path: str
    role: LanguageDataRole
    training_eligible: bool = False
    presence: AssetPresence = AssetPresence.UNKNOWN
    sha256: str | None = None
    expected_sha256: str | None = None
    notes: str | None = None

    @field_validator("training_eligible")
    @classmethod
    def _frozen_never_train(cls, v: bool, info) -> bool:
        role = info.data.get("role")
        if role == LanguageDataRole.FROZEN_EVAL and v:
            raise ValueError("FROZEN_EVAL_MUST_NOT_BE_TRAINING_ELIGIBLE")
        return v


class KbRebuildStatus(str, Enum):
    """Source→index rebuildability for GAP-P2-005."""

    FULL_REBUILD_READY = "FULL_REBUILD_READY"
    INCREMENTAL_FROM_PROCESSED = "INCREMENTAL_FROM_PROCESSED"
    INDEX_PRESENT_SOURCES_MISSING = "INDEX_PRESENT_SOURCES_MISSING"
    BLOCKED = "BLOCKED"
    UNKNOWN = "UNKNOWN"


class KbRebuildStepV1(ContractBase):
    step_id: str
    command: str
    required_inputs: tuple[str, ...] = ()
    produces: tuple[str, ...] = ()
    optional: bool = False


class KbRebuildabilityReportV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: LanguageDataGovernanceStatus = LanguageDataGovernanceStatus.NOT_RUN
    runtime_version: str = "mai-12.0.2-slice2"
    rebuild_status: KbRebuildStatus = KbRebuildStatus.UNKNOWN
    config_present: bool = False
    source_archives_present: int = Field(ge=0, default=0)
    processed_jsonl_present: bool = False
    lexical_index_present: bool = False
    pipeline_scripts_present: bool = False
    recipe_steps: tuple[KbRebuildStepV1, ...] = ()
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)


class LanguageDataCatalogV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: LanguageDataGovernanceStatus = LanguageDataGovernanceStatus.NOT_RUN
    runtime_version: str = "mai-12.0.2-slice2"
    catalog_version: str = "mai-12.catalog.v1"
    assets: tuple[LanguageDataAssetV1, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    frozen_training_violations: int = Field(ge=0, default=0)
    hash_mismatches: int = Field(ge=0, default=0)
    missing_required: int = Field(ge=0, default=0)
    # MAI-12 slice 2
    kb_rebuildability: KbRebuildabilityReportV1 | None = None

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)
