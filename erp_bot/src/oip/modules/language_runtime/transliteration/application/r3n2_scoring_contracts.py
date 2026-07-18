"""MAI-07R3N2 versioned scoring contracts.

No max(1, denominator). Empty required → INVALID_REQUIRED_POPULATION.
Empty optional → NOT_APPLICABLE. Requiredness cannot change after lock.
Below-minimum required population → BLOCKED_INSUFFICIENT_POPULATION (pre-holdout).
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

SCORER_VERSION = "mai-07-r3n2.scorer.1.0.0"
FORMULA_VERSION = "mai-07-r3n2.formula.1.0.0"
CONTRACT_VERSION = "mai-07-r3n2.contract.1.0.0"

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
    "ENGLISH_GUARD_ANALOGUE",
    "IDENTITY_INVARIANT_ANALOGUE",
    "ACRONYM_IDENTIFIER_ANALOGUE",
)

# Locked minimum unique-case denominators for HOLDOUT_VALIDATION (and analogues).
MINIMUM_DENOMINATORS = {
    "ENGLISH_IDENTITY_REQUIRED": 200,
    "ROMANIZED_NEPALI_REQUIRED": 200,
    "IDENTITY_RETENTION_REQUIRED": 150,  # retention-or-cap pressure lane
    "ACRONYM_IDENTITY_REQUIRED": 100,
    "IDENTIFIER_PROTECTION_REQUIRED": 100,
    "PROTECTED_IDENTITY_REQUIRED": 100,
    "SHARED_OR_AMBIGUOUS": 150,
    "ENGLISH_GUARD_ANALOGUE": 100,
    "IDENTITY_INVARIANT_ANALOGUE": 100,
    "ACRONYM_IDENTIFIER_ANALOGUE": 75,
    "CONTEXT_COUNTERFACTUAL": 300,  # 150 pairs
    "OOV": 100,
    "MONOTONIC_PARENT_CORRECT": 300,
}

SPLIT_SIZE_MINIMA = {
    "DEVELOPMENT": 500,
    "HOLDOUT_VALIDATION": 1000,
    "SAFETY_CHALLENGE": 400,
    "CONTEXT_COUNTERFACTUAL": 300,
    "OOV_CHALLENGE": 100,
    "MONOTONIC_REGRESSION": 300,
}

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
        "english_guard_analogue",
        "identity_invariant_analogue",
        "acronym_identifier_analogue",
    }
)
DEVELOPMENT_ONLY_GATES = frozenset({"authorized_code_corrective"})


def metric_required_when_empty(metric_id: str, split: str) -> bool:
    """Empty population → INVALID only when the split requires that gate.

    Required populations must never become NOT_APPLICABLE after lock on required splits.
    """
    if metric_id in DEVELOPMENT_ONLY_GATES:
        return split == "DEVELOPMENT"
    if metric_id in CORE_POLICY_GATES:
        return split in {"DEVELOPMENT", "HOLDOUT_VALIDATION"}
    return False


def check_population_minima(population_counts: dict[str, int], *, split: str) -> dict:
    """Pre-holdout gate. Returns ok=False with BLOCKED_INSUFFICIENT_POPULATION when short."""
    failures: list[dict] = []
    if split == "HOLDOUT_VALIDATION":
        for pid, minimum in MINIMUM_DENOMINATORS.items():
            if pid in {"CONTEXT_COUNTERFACTUAL", "OOV", "MONOTONIC_PARENT_CORRECT"}:
                continue  # those live on supporting splits
            have = int(population_counts.get(pid, 0))
            if have < minimum:
                failures.append({"population_id": pid, "have": have, "minimum": minimum})
    elif split == "CONTEXT_COUNTERFACTUAL":
        have = int(population_counts.get("CONTEXT_COUNTERFACTUAL", 0))
        if have < MINIMUM_DENOMINATORS["CONTEXT_COUNTERFACTUAL"]:
            failures.append(
                {
                    "population_id": "CONTEXT_COUNTERFACTUAL",
                    "have": have,
                    "minimum": MINIMUM_DENOMINATORS["CONTEXT_COUNTERFACTUAL"],
                }
            )
    elif split == "OOV_CHALLENGE":
        have = int(population_counts.get("OOV", 0))
        if have < MINIMUM_DENOMINATORS["OOV"]:
            failures.append({"population_id": "OOV", "have": have, "minimum": MINIMUM_DENOMINATORS["OOV"]})
    elif split == "MONOTONIC_REGRESSION":
        have = int(population_counts.get("MONOTONIC_PARENT_CORRECT", 0))
        if have < MINIMUM_DENOMINATORS["MONOTONIC_PARENT_CORRECT"]:
            failures.append(
                {
                    "population_id": "MONOTONIC_PARENT_CORRECT",
                    "have": have,
                    "minimum": MINIMUM_DENOMINATORS["MONOTONIC_PARENT_CORRECT"],
                }
            )
    return {
        "ok": not failures,
        "verdict": None if not failures else "BLOCKED_INSUFFICIENT_POPULATION",
        "failures": failures,
        "split": split,
    }


__all__ = [
    "SCORER_VERSION",
    "FORMULA_VERSION",
    "CONTRACT_VERSION",
    "REQUIRED_POPULATIONS",
    "MINIMUM_DENOMINATORS",
    "SPLIT_SIZE_MINIMA",
    "CORE_POLICY_GATES",
    "DEVELOPMENT_ONLY_GATES",
    "metric_required_when_empty",
    "check_population_minima",
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
