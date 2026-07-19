"""MAI-34 explicit confirmation / OEC dispatch — policy annotation (never posts)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class ExplicitConfirmationOecDispatchStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class ConfirmReadiness(str, Enum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    POLICY_DECLARED = "POLICY_DECLARED"
    BLOCKED = "BLOCKED"
    PENDING_TOKEN = "PENDING_TOKEN"


class OecDispatchReadiness(str, Enum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    POLICY_DECLARED = "POLICY_DECLARED"
    BLOCKED = "BLOCKED"
    NOT_PRODUCT_PATH = "NOT_PRODUCT_PATH"


class ConfirmPolicy(str, Enum):
    EXPLICIT_UI_CONFIRM_REQUIRED = "EXPLICIT_UI_CONFIRM_REQUIRED"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class ProductMutationPath(str, Enum):
    DEXIE_EXECUTE_ORBIX_CONFIRM = "DEXIE_EXECUTE_ORBIX_CONFIRM"
    UNKNOWN = "UNKNOWN"


class ActionToOecStatus(str, Enum):
    NOT_PRODUCT_PATH = "NOT_PRODUCT_PATH"
    PARTIAL_RUNTIME_EXISTS = "PARTIAL_RUNTIME_EXISTS"


class ExplicitConfirmationOecDispatchBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: ExplicitConfirmationOecDispatchStatus = (
        ExplicitConfirmationOecDispatchStatus.NOT_RUN
    )
    runtime_version: str = "mai-34.0.1-slice1"
    source_authority: str = "REQUEST"
    selected_port_id: str | None = None
    draft_module_id: str | None = None
    event_type: str = "unknown"
    confirm_readiness: ConfirmReadiness = ConfirmReadiness.NOT_APPLICABLE
    oec_dispatch_readiness: OecDispatchReadiness = OecDispatchReadiness.NOT_APPLICABLE
    confirm_policy: ConfirmPolicy = ConfirmPolicy.NOT_APPLICABLE
    confirm_token_status: str = "NOT_ISSUED"
    revalidation_policy: str = "REQUIRED_BEFORE_DISPATCH"
    product_mutation_path: ProductMutationPath = ProductMutationPath.UNKNOWN
    action_to_oec_status: ActionToOecStatus = ActionToOecStatus.NOT_PRODUCT_PATH
    idempotency_policy: str = "KEY_REQUIRED_ON_DISPATCH"
    receipt_contract: str = "RECEIPT_V1_PENDING"
    calc_authority_on_confirm: str = "DEXIE_DOMAIN_ENGINE"
    stale_preview_on_confirm: str = "REJECT"
    preview_hash_required_on_confirm: bool = True
    draft_version_bound: bool = True
    nl_assent_posts: bool = False
    gap_p0_001_status: str = "OPEN"
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    confirm_token_minted: bool = False
    confirm_accepted: bool = False
    nl_yes_treated_as_confirm: bool = False
    revalidation_executed: bool = False
    action_runtime_invoked: bool = False
    oec_dispatch_invoked: bool = False
    dispatch_envelope_built: bool = False
    erp_command_posted: bool = False
    dexie_post_invoked: bool = False
    khata_confirm_invoked: bool = False
    mode_aware_invoked: bool = False
    receipt_returned: bool = False
    draft_mutations: int = Field(ge=0, default=0)
    posting_mutations: int = Field(ge=0, default=0)

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

    @field_validator("gap_p0_001_status")
    @classmethod
    def _gap(cls, v: str) -> str:
        if v != "OPEN":
            raise ValueError("GAP_P0_001_MUST_REMAIN_OPEN")
        return v

    @field_validator("confirm_token_status")
    @classmethod
    def _token(cls, v: str) -> str:
        if v != "NOT_ISSUED":
            raise ValueError("CONFIRM_TOKEN_MUST_NOT_BE_ISSUED")
        return v

    @field_validator("nl_assent_posts")
    @classmethod
    def _nl(cls, v: bool) -> bool:
        if v:
            raise ValueError("NL_ASSENT_MUST_NOT_POST")
        return v

    @field_validator(
        "confirm_token_minted",
        "confirm_accepted",
        "nl_yes_treated_as_confirm",
        "revalidation_executed",
        "action_runtime_invoked",
        "oec_dispatch_invoked",
        "dispatch_envelope_built",
        "erp_command_posted",
        "dexie_post_invoked",
        "khata_confirm_invoked",
        "mode_aware_invoked",
        "receipt_returned",
    )
    @classmethod
    def _never_execute(cls, v: bool) -> bool:
        if v:
            raise ValueError("CONFIRM_OEC_MUST_NOT_EXECUTE")
        return v

    @field_validator("draft_mutations", "posting_mutations")
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("CONFIRM_OEC_MUST_NOT_MUTATE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
