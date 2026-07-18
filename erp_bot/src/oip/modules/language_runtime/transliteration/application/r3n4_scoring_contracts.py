"""MAI-07R3N4 versioned scoring contracts.

No max(1, denominator). Empty required → INVALID_REQUIRED_POPULATION.
Empty optional → NOT_APPLICABLE. Requiredness cannot change after lock.
Below-minimum required population → BLOCKED_INSUFFICIENT_POPULATION (pre-holdout).

R3N4 expands R3N3's identity-invariant populations with identity-anchor-specific
requirements: exact-raw identity, exactly-one identity, finalizer idempotence
(scored across all holdout cases), serialization round-trip, path finalization
coverage, and anchor validity. IDENTITY_ANCHOR_CHALLENGE replaces R3N3's
IDENTITY_CAP_PRESSURE_CHALLENGE as the supporting split.
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

SCORER_VERSION = "mai-07-r3n4.scorer.1.0.0"
FORMULA_VERSION = "mai-07-r3n4.formula.1.0.0"
CONTRACT_VERSION = "mai-07-r3n4.contract.1.0.0"

REQUIRED_POPULATIONS = (
    "ENGLISH_IDENTITY_REQUIRED",
    "ROMANIZED_NEPALI_REQUIRED",
    "IDENTITY_RETENTION_REQUIRED",
    "EXACT_RAW_IDENTITY_REQUIRED",
    "EXACTLY_ONE_IDENTITY_REQUIRED",
    "FINALIZER_IDEMPOTENCE_REQUIRED",
    "IDENTITY_INVARIANT_ANALOGUE",
    "CANDIDATE_CAP_PRESSURE",
    "MULTI_TOKEN_IDENTITY",
    "REFINED_SPAN_IDENTITY",
    "COALESCED_SPAN_IDENTITY",
    "SERIALIZATION_ROUNDTRIP",
    "UNICODE_IDENTITY",
    "IDENTITY_ANCHOR_CHALLENGE",
    "ACRONYM_IDENTITY_REQUIRED",
    "IDENTIFIER_PROTECTION_REQUIRED",
    "PROTECTED_IDENTITY_REQUIRED",
    "SHARED_OR_AMBIGUOUS",
    "CONTEXT_COUNTERFACTUAL",
    "OOV",
    "MONOTONIC_PARENT_CORRECT",
    "MONOTONIC_PARENT_INCORRECT",
    "AUTHORIZED_CODE_CORRECTIVE",
    "ENGLISH_GUARD_ANALOGUE",
    "ACRONYM_IDENTIFIER_ANALOGUE",
)

MINIMUM_DENOMINATORS = {
    "ENGLISH_IDENTITY_REQUIRED": 200,
    "ROMANIZED_NEPALI_REQUIRED": 200,
    "IDENTITY_RETENTION_REQUIRED": 500,
    "EXACT_RAW_IDENTITY_REQUIRED": 500,
    "EXACTLY_ONE_IDENTITY_REQUIRED": 500,
    "FINALIZER_IDEMPOTENCE_REQUIRED": 1500,
    "IDENTITY_INVARIANT_ANALOGUE": 350,
    "CANDIDATE_CAP_PRESSURE": 300,
    "MULTI_TOKEN_IDENTITY": 300,
    "REFINED_SPAN_IDENTITY": 200,
    "COALESCED_SPAN_IDENTITY": 200,
    "SERIALIZATION_ROUNDTRIP": 300,
    "UNICODE_IDENTITY": 150,
    "ACRONYM_IDENTITY_REQUIRED": 100,
    "IDENTIFIER_PROTECTION_REQUIRED": 100,
    "PROTECTED_IDENTITY_REQUIRED": 100,
    "SHARED_OR_AMBIGUOUS": 150,
    "ENGLISH_GUARD_ANALOGUE": 100,
    "ACRONYM_IDENTIFIER_ANALOGUE": 75,
    "CONTEXT_COUNTERFACTUAL": 300,
    "OOV": 100,
    "MONOTONIC_PARENT_CORRECT": 300,
    "IDENTITY_ANCHOR_CHALLENGE": 500,
}

SPLIT_SIZE_MINIMA = {
    "DEVELOPMENT": 800,
    "HOLDOUT_VALIDATION": 1500,
    "SAFETY_CHALLENGE": 400,
    "CONTEXT_COUNTERFACTUAL": 300,
    "OOV_CHALLENGE": 100,
    "MONOTONIC_REGRESSION": 400,
    "IDENTITY_ANCHOR_CHALLENGE": 500,
}

CORE_POLICY_GATES = frozenset(
    {
        "english_identity_top1",
        "false_devanagari_on_english",
        "romanized_script_at_5",
        "identity_retention",
        "identity_invariant_analogue",
        "cap_pressure_identity_retention",
        "exact_raw_identity",
        "exactly_one_identity",
        "finalizer_idempotence",
        "serialization_roundtrip",
        "path_finalization_coverage",
        "anchor_validity",
        "acronym_identity_top1",
        "identifier_identity_top1",
        "protected_identity",
        "caps_ok",
        "raw_ok_all",
        "english_guard_analogue",
        "acronym_identifier_analogue",
    }
)
DEVELOPMENT_ONLY_GATES = frozenset({"authorized_code_corrective"})

# Populations whose count is computed once over the full holdout (or split) rather
# than a distinct sub-population; excluded from the per-population minima loop
# because their denominator equals the split size itself.
_HOLDOUT_ALL_CASES_POPULATIONS = frozenset({"FINALIZER_IDEMPOTENCE_REQUIRED"})


def metric_required_when_empty(metric_id: str, split: str) -> bool:
    """Empty population → INVALID only when the split requires that gate."""
    if metric_id in DEVELOPMENT_ONLY_GATES:
        return split == "DEVELOPMENT"
    if metric_id == "cap_pressure_identity_retention" and split == "IDENTITY_ANCHOR_CHALLENGE":
        return True
    if metric_id in CORE_POLICY_GATES:
        return split in {"DEVELOPMENT", "HOLDOUT_VALIDATION"}
    return False


def check_population_minima(population_counts: dict[str, int], *, split: str) -> dict:
    """Pre-holdout gate. Returns ok=False with BLOCKED_INSUFFICIENT_POPULATION when short."""
    failures: list[dict] = []
    if split == "HOLDOUT_VALIDATION":
        for pid, minimum in MINIMUM_DENOMINATORS.items():
            if pid in {
                "CONTEXT_COUNTERFACTUAL",
                "OOV",
                "MONOTONIC_PARENT_CORRECT",
                "IDENTITY_ANCHOR_CHALLENGE",
            }:
                continue
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
    elif split == "IDENTITY_ANCHOR_CHALLENGE":
        have = int(population_counts.get("IDENTITY_ANCHOR_CHALLENGE", 0))
        if have < MINIMUM_DENOMINATORS["IDENTITY_ANCHOR_CHALLENGE"]:
            failures.append(
                {
                    "population_id": "IDENTITY_ANCHOR_CHALLENGE",
                    "have": have,
                    "minimum": MINIMUM_DENOMINATORS["IDENTITY_ANCHOR_CHALLENGE"],
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
