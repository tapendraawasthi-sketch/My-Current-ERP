"""MAI-38 slice 2 — consume calculator/rule policy into candidates.

Default: CANDIDATE_ONLY (build calculator/rule candidate; never calculates).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never live calculation, rule-table authority, or definitive law.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.request import CanonicalAIRequestV1
from ....contracts.tax_calculator_rule_integration import (
    CalculatorReadiness,
    TaxCalculatorRuleIntegrationBundleV1,
    TaxCalculatorRuleIntegrationStatus,
)

RUNTIME_VERSION = "mai-38.0.2-slice2"
AUTHORITY = "ADR_0055"


def _as_tcri_meta(
    bundle: Mapping[str, Any] | TaxCalculatorRuleIntegrationBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, TaxCalculatorRuleIntegrationBundleV1):
        from .tax_calculator_rule_integration_service import (
            tax_calculator_rule_integration_to_metadata,
        )

        return tax_calculator_rule_integration_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("tax_calculator_invoked") is True
        or data.get("calculation_executed") is True
        or data.get("amount_computed") is True
        or data.get("rate_applied") is True
        or data.get("rule_table_loaded") is True
        or data.get("calculator_production_eligible") is True
        or data.get("current_law_definitive") is True
        or data.get("legal_effective_dates_proven") is True
        or data.get("amendment_applied") is True
        or data.get("claims_verified") is True
        or data.get("citations_verified") is True
        or data.get("legal_proof_claimed") is True
        or data.get("kb_retrieval_invoked") is True
        or data.get("rate_lookup_executed") is True
        or int(data.get("documents_retrieved") or 0) != 0
        or int(data.get("draft_mutations") or 0) != 0
        or int(data.get("posting_mutations") or 0) != 0
        or str(data.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(data.get("rule_integration_status") or "POLICY_ONLY")
        != "POLICY_ONLY"
    )


def resolve_calculator_consume_mode(
    bundle: Mapping[str, Any] | TaxCalculatorRuleIntegrationBundleV1 | None,
    *,
    allow_rule_table_load: bool = False,
    allow_live_calculation: bool = False,
) -> str:
    """Return consume mode (never implies live calc on default path)."""
    data = _as_tcri_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != TaxCalculatorRuleIntegrationStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(data.get("calculator_readiness") or "")
    if readiness == CalculatorReadiness.BLOCKED.value:
        return "BLOCKED"
    if readiness == CalculatorReadiness.NOT_APPLICABLE.value:
        return "SKIP"
    if readiness not in {
        CalculatorReadiness.POLICY_DECLARED.value,
        CalculatorReadiness.RULE_TABLE_PENDING.value,
    }:
        return "SKIP"
    if allow_live_calculation:
        return "INVOKE_LIVE_CALCULATION"
    if allow_rule_table_load:
        return "INVOKE_RULE_TABLE_LOAD"
    return "CANDIDATE_ONLY"


def build_calculator_rule_candidate(
    bundle: Mapping[str, Any] | TaxCalculatorRuleIntegrationBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_rule_table_load: bool = False,
    allow_live_calculation: bool = False,
) -> dict[str, Any]:
    """Build calculator/rule candidate (never calculates or posts)."""
    data = _as_tcri_meta(bundle)
    mode = resolve_calculator_consume_mode(
        data,
        allow_rule_table_load=allow_rule_table_load,
        allow_live_calculation=allow_live_calculation,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "calculator_consume_mode": mode,
        "calculator_consume_ready": False,
        "calculator_rule_candidate": None,
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
        "kb_retrieval_invoked": False,
        "rate_lookup_executed": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "gap_p2_008_status": "OPEN",
        "rule_integration_status": "POLICY_ONLY",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_rule_table_load": False,
        "allow_live_calculation": False,
    }
    if data is None or mode in {"UNCHANGED", "SKIP", "BLOCKED"}:
        return base

    candidate = {
        "calculator_readiness": data.get("calculator_readiness"),
        "rule_integration_status": "POLICY_ONLY",
        "pilot_bound": bool(data.get("pilot_bound")),
        "calc_intent_detected": bool(data.get("calc_intent_detected")),
        "rule_table_refs": None,
        "computed_amount": None,
        "applied_rate": None,
        "definitive_answer": None,
        "tax_calculator_invoked": False,
        "calculation_executed": False,
        "amount_computed": False,
        "rate_applied": False,
        "rule_table_loaded": False,
        "calculator_production_eligible": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(data.get("pilot_bound"))
    base.update(
        {
            "calculator_consume_ready": ready,
            "calculator_rule_candidate": candidate,
        }
    )
    return base


def calculator_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_rule_table_load: bool = False,
    allow_live_calculation: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_rule_table_load, allow_live_calculation
    built = build_calculator_rule_candidate(
        request.tax_calculator_rule_integration_bundle,
        field_overrides={},
        allow_rule_table_load=False,
        allow_live_calculation=False,
    )
    return {
        "calculator_consume_mode": built["calculator_consume_mode"],
        "calculator_consume_ready": bool(built["calculator_consume_ready"]),
        "calculator_rule_candidate": built.get("calculator_rule_candidate"),
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
        "kb_retrieval_invoked": False,
        "rate_lookup_executed": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "gap_p2_008_status": "OPEN",
        "rule_integration_status": "POLICY_ONLY",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_rule_table_load": False,
        "allow_live_calculation": False,
    }


def assert_calculator_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("tax_calculator_invoked") is True
        or obs.get("calculation_executed") is True
        or obs.get("amount_computed") is True
        or obs.get("rate_applied") is True
        or obs.get("rule_table_loaded") is True
        or obs.get("calculator_production_eligible") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_rule_table_load") is True
        or obs.get("allow_live_calculation") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("rule_integration_status") or "POLICY_ONLY")
        != "POLICY_ONLY"
    ):
        raise RuntimeError("CALCULATOR_CONSUME_AUTHORITY")


def enrich_tcri_metadata_with_consume(
    tcri_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(tcri_meta)
    obs = calculator_consume_observability(
        request,
        allow_rule_table_load=False,
        allow_live_calculation=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
