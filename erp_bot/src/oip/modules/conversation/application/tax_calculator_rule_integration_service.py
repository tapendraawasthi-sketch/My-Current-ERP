"""MAI-38 — tax calculator / rule integration policy (never calculates).

Slice 1: declare calculator/rule policy from MAI-37 tax pilot.
Never loads rule tables, never computes amounts, never posts.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.core_nepal_tax_knowledge_pilot import (
    CoreNepalTaxKnowledgePilotStatus,
    TaxPilotReadiness,
)
from ....contracts.request import CanonicalAIRequestV1
from ....contracts.tax_calculator_rule_integration import (
    CalculatorReadiness,
    TaxCalculatorRuleIntegrationBundleV1,
    TaxCalculatorRuleIntegrationStatus,
)

RUNTIME_VERSION = "mai-38.0.1-slice1"
AUTHORITY = "ADR_0055"

_CALC_INTENT = re.compile(
    r"\b(?:calculat(?:e|ion|ed)|compute|काम\s*गर|हिसाब\s*गर|"
    r"tax\s+on\s+\d|VAT\s+on\s+\d|TDS\s+on\s+\d)\b",
    re.IGNORECASE,
)


def build_tax_calculator_rule_integration_bundle(
    request: CanonicalAIRequestV1,
) -> TaxCalculatorRuleIntegrationBundleV1:
    ctk = request.core_nepal_tax_knowledge_pilot_bundle
    if ctk is None:
        return TaxCalculatorRuleIntegrationBundleV1(
            analysis_status=TaxCalculatorRuleIntegrationStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            calculator_readiness=CalculatorReadiness.NOT_APPLICABLE,
            reason_codes=("NO_TAX_PILOT",),
            warnings=("NO_TAX_PILOT",),
        )

    if ctk.analysis_status != CoreNepalTaxKnowledgePilotStatus.COMPLETE:
        return TaxCalculatorRuleIntegrationBundleV1(
            analysis_status=TaxCalculatorRuleIntegrationStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            calculator_readiness=CalculatorReadiness.NOT_APPLICABLE,
            reason_codes=(
                "TAX_PILOT_NOT_COMPLETE",
                "TAX_CALCULATOR_NOT_APPLICABLE",
            ),
            warnings=("TAX_CALCULATOR_NOT_APPLICABLE",),
        )

    if ctk.tax_pilot_readiness == TaxPilotReadiness.BLOCKED:
        return TaxCalculatorRuleIntegrationBundleV1(
            analysis_status=TaxCalculatorRuleIntegrationStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            calculator_readiness=CalculatorReadiness.BLOCKED,
            pilot_bound=True,
            reason_codes=(
                "UPSTREAM_TAX_PILOT_BLOCKED",
                "NO_LIVE_CALCULATION",
                "NO_RULE_TABLE_LOAD",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "GAP_P2_008_REMAINS_OPEN",
                "CALCULATOR_PRODUCTION_INELIGIBLE",
            ),
        )

    if ctk.tax_pilot_readiness not in {
        TaxPilotReadiness.POLICY_DECLARED,
        TaxPilotReadiness.SCOPE_PARTIAL,
    }:
        return TaxCalculatorRuleIntegrationBundleV1(
            analysis_status=TaxCalculatorRuleIntegrationStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            calculator_readiness=CalculatorReadiness.NOT_APPLICABLE,
            reason_codes=("TAX_PILOT_READINESS_NOT_ELIGIBLE",),
            warnings=("TAX_CALCULATOR_NOT_APPLICABLE",),
        )

    calc_intent = bool(_CALC_INTENT.search(request.raw_text or ""))
    readiness = CalculatorReadiness.POLICY_DECLARED
    reasons = [
        "TAX_PILOT_BOUND",
        "CALCULATOR_POLICY_DECLARED",
        "RULE_INTEGRATION_POLICY_ONLY",
        "NO_LIVE_CALCULATION",
        "NO_AMOUNT_COMPUTED",
        "NO_RATE_APPLIED",
        "NO_RULE_TABLE_LOAD",
        "CALCULATOR_PRODUCTION_INELIGIBLE",
        "NO_KB_RETRIEVAL_AUTHORITY",
        "CURRENT_LAW_NOT_DEFINITIVE",
        "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
        "CLAIMS_NOT_VERIFIED",
        "GAP_P2_008_OPEN",
    ]
    if calc_intent:
        reasons.append("CALC_INTENT_DETECTED_NOT_EXECUTED")
    if ctk.tax_pilot_readiness == TaxPilotReadiness.SCOPE_PARTIAL:
        reasons.append("UPSTREAM_SCOPE_PARTIAL_STILL_UNPROVEN")
        readiness = CalculatorReadiness.RULE_TABLE_PENDING

    return TaxCalculatorRuleIntegrationBundleV1(
        analysis_status=TaxCalculatorRuleIntegrationStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        calculator_readiness=readiness,
        pilot_bound=True,
        calc_intent_detected=calc_intent,
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "LEGAL_EFFECTIVE_DATES_NOT_PROVEN",
            "CALCULATOR_NOT_PRODUCTION_ELIGIBLE",
            "RULE_TABLES_NOT_LOADED",
            "AMOUNTS_NOT_COMPUTED",
        ),
    )


def attach_tax_calculator_rule_integration_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_tax_calculator_rule_integration_bundle(request)
    return request.model_copy(
        update={"tax_calculator_rule_integration_bundle": bundle}
    )


def assert_tax_calculator_rule_integration_authority(
    bundle: TaxCalculatorRuleIntegrationBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.tax_calculator_invoked
        or bundle.calculation_executed
        or bundle.amount_computed
        or bundle.rate_applied
        or bundle.rule_table_loaded
        or bundle.calculator_production_eligible
        or bundle.current_law_definitive
        or bundle.legal_effective_dates_proven
        or bundle.amendment_applied
        or bundle.claims_verified
        or bundle.citations_verified
        or bundle.legal_proof_claimed
        or bundle.kb_retrieval_invoked
        or bundle.rate_lookup_executed
        or bundle.documents_retrieved != 0
        or bundle.draft_mutations != 0
        or bundle.posting_mutations != 0
        or bundle.gap_p2_008_status != "OPEN"
        or bundle.rule_integration_status != "POLICY_ONLY"
    ):
        raise RuntimeError("TAX_CALCULATOR_RULE_INTEGRATION_AUTHORITY")


def tax_calculator_rule_integration_to_metadata(
    bundle: TaxCalculatorRuleIntegrationBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "calculator_readiness": bundle.calculator_readiness.value,
        "rule_integration_status": "POLICY_ONLY",
        "pilot_bound": bundle.pilot_bound,
        "calc_intent_detected": bundle.calc_intent_detected,
        "mutation_tools_allowed": False,
        "tax_calculator_invoked": False,
        "calculation_executed": False,
        "amount_computed": False,
        "rate_applied": False,
        "rule_table_loaded": False,
        "calculator_production_eligible": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "claims_verified": False,
        "legal_proof_claimed": False,
        "gap_p2_008_status": "OPEN",
        "kb_retrieval_invoked": False,
        "rate_lookup_executed": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
