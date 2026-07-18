"""MAI-07R3N versioned scoring contracts.

No max(1, denominator). Empty required → INVALID_REQUIRED_POPULATION.
Empty optional → NOT_APPLICABLE.
"""

from __future__ import annotations

from .r3h2_scoring_contracts import (
    CounterfactualGroupResult,
    EvaluationPopulation,
    GateOutcome,
    GateResult,
    MetricApplicability,
    MetricResult,
    build_metric,
    evaluate_gate,
    metric_value,
)

SCORER_VERSION = "mai-07-r3n.scorer.1.0.0"
FORMULA_VERSION = "mai-07-r3n.formula.1.0.0"

REQUIRED_POPULATIONS = (
    "ENGLISH_IDENTITY_REQUIRED",
    "ROMANIZED_NEPALI_REQUIRED",
    "IDENTITY_RETENTION_REQUIRED",
    "ACRONYM_IDENTITY_REQUIRED",
    "IDENTIFIER_PROTECTION_REQUIRED",
    "PROTECTED_IDENTITY_REQUIRED",
    "SHARED_OR_AMBIGUOUS",
    "CONTEXT_COUNTERFACTUAL",
    "CANDIDATE_CAP_PRESSURE",
    "OOV",
    "MONOTONIC_PARENT_CORRECT",
    "MONOTONIC_PARENT_INCORRECT",
    "AUTHORIZED_CODE_CORRECTIVE",
)

# Gates that must have non-empty denominators on DEVELOPMENT / HOLDOUT_VALIDATION.
# Empty on other splits → NOT_APPLICABLE (optional). AUTHORIZED_CODE_CORRECTIVE is DEVELOPMENT-only.
CORE_POLICY_GATES = frozenset(
    {
        "english_identity_top1",
        "false_devanagari_on_english",
        "romanized_script_at_5",
        "identity_retention",
        "acronym_identity_top1",
        "identifier_identity_top1",
        "protected_identity",
        "caps_ok",
        "raw_ok_all",
    }
)
DEVELOPMENT_ONLY_GATES = frozenset({"authorized_code_corrective"})


def metric_required_when_empty(metric_id: str, split: str) -> bool:
    """Empty population → INVALID only when the split requires that gate."""
    if metric_id in DEVELOPMENT_ONLY_GATES:
        return split == "DEVELOPMENT"
    if metric_id in CORE_POLICY_GATES:
        return split in {"DEVELOPMENT", "HOLDOUT_VALIDATION"}
    return False

__all__ = [
    "SCORER_VERSION",
    "FORMULA_VERSION",
    "REQUIRED_POPULATIONS",
    "CORE_POLICY_GATES",
    "DEVELOPMENT_ONLY_GATES",
    "metric_required_when_empty",
    "CounterfactualGroupResult",
    "EvaluationPopulation",
    "GateOutcome",
    "GateResult",
    "MetricApplicability",
    "MetricResult",
    "build_metric",
    "evaluate_gate",
    "metric_value",
]
