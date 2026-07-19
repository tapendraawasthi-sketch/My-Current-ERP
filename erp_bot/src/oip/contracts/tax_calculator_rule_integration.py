"""MAI-38 tax calculator / rule integration — policy annotation (never calculates)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator

from .common import ContractBase, default_schema_version
from .registry import get_contract_registry


class TaxCalculatorRuleIntegrationStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    COMPLETE = "COMPLETE"
    SKIP = "SKIP"
    FAILED = "FAILED"


class CalculatorReadiness(str, Enum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    POLICY_DECLARED = "POLICY_DECLARED"
    BLOCKED = "BLOCKED"
    RULE_TABLE_PENDING = "RULE_TABLE_PENDING"


class TaxCalculatorRuleIntegrationBundleV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    analysis_status: TaxCalculatorRuleIntegrationStatus = (
        TaxCalculatorRuleIntegrationStatus.NOT_RUN
    )
    runtime_version: str = "mai-38.0.1-slice1"
    source_authority: str = "REQUEST"
    calculator_readiness: CalculatorReadiness = CalculatorReadiness.NOT_APPLICABLE
    rule_integration_status: str = "POLICY_ONLY"
    pilot_bound: bool = False
    calc_intent_detected: bool = False
    mutation_tools_allowed: bool = False
    tax_calculator_invoked: bool = False
    calculation_executed: bool = False
    amount_computed: bool = False
    rate_applied: bool = False
    rule_table_loaded: bool = False
    calculator_production_eligible: bool = False
    current_law_definitive: bool = False
    legal_effective_dates_proven: bool = False
    amendment_applied: bool = False
    claims_verified: bool = False
    citations_verified: bool = False
    legal_proof_claimed: bool = False
    gap_p2_008_status: str = "OPEN"
    reason_codes: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    error_codes: tuple[str, ...] = ()
    kb_retrieval_invoked: bool = False
    rate_lookup_executed: bool = False
    documents_retrieved: int = Field(ge=0, default=0)
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

    @field_validator("rule_integration_status")
    @classmethod
    def _rule(cls, v: str) -> str:
        if v != "POLICY_ONLY":
            raise ValueError("RULE_INTEGRATION_MUST_STAY_POLICY_ONLY")
        return v

    @field_validator("mutation_tools_allowed")
    @classmethod
    def _mut(cls, v: bool) -> bool:
        if v:
            raise ValueError("TAX_CALCULATOR_MUST_NOT_ALLOW_MUTATION")
        return v

    @field_validator(
        "tax_calculator_invoked",
        "calculation_executed",
        "amount_computed",
        "rate_applied",
        "rule_table_loaded",
        "calculator_production_eligible",
        "current_law_definitive",
        "legal_effective_dates_proven",
        "amendment_applied",
        "claims_verified",
        "citations_verified",
        "legal_proof_claimed",
        "kb_retrieval_invoked",
        "rate_lookup_executed",
    )
    @classmethod
    def _never_claim(cls, v: bool) -> bool:
        if v:
            raise ValueError("TAX_CALCULATOR_MUST_NOT_CLAIM_OR_EXECUTE")
        return v

    @field_validator("gap_p2_008_status")
    @classmethod
    def _gap(cls, v: str) -> str:
        if v != "OPEN":
            raise ValueError("GAP_P2_008_MUST_REMAIN_OPEN")
        return v

    @field_validator("documents_retrieved", "draft_mutations", "posting_mutations")
    @classmethod
    def _zero(cls, v: int) -> int:
        if v != 0:
            raise ValueError("TAX_CALCULATOR_MUST_NOT_MUTATE_OR_RETRIEVE")
        return v

    @property
    def is_execution_authority(self) -> bool:
        return False
