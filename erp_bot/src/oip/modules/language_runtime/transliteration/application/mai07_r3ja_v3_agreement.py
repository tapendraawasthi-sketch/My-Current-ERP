"""MAI-07R3J-A — agreement formulas and acceptance gates (pre-declared)."""

from __future__ import annotations

from typing import Any, Sequence

ROUND_A_DISPOSITIONS = (
    "ENGLISH_IDENTITY_REQUIRED",
    "DEVANAGARI_TRANSLITERATION_REQUIRED",
    "CONTEXT_DEPENDENT",
    "IDENTITY_FIRST_REVIEW_REQUIRED",
    "TRANSLITERATION_OPTIONAL",
    "NO_TRANSLITERATION_ALLOWED",
    "NAME_OR_ENTITY",
    "ACRONYM_OR_IDENTIFIER",
    "PROTECTED",
    "ABSTAIN_CANNOT_DECIDE",
)

ROUND_B_ACCEPTABILITY = (
    "ACCEPTABLE_PREFERRED",
    "ACCEPTABLE_ALTERNATIVE",
    "UNNATURAL_BUT_POSSIBLE",
    "INCORRECT",
    "CANNOT_DECIDE",
)

ACCEPTANCE_GATES = {
    "round_a_completion": 1.0,
    "round_b_completion_eligible": 1.0,
    "duplicate_consistency": 0.90,
    "exact_disposition_agreement": 0.85,
    "cohen_kappa_min": 0.70,
    "professional_linguist_completion": 1.0,
    "domain_review_completion_technical": 1.0,
    "unresolved_disagreement_after_adjudication_frozen": 0,
    "invalid_enum_or_duplicate_id": 0,
    "candidate_index_mismatch": 0,
    "formula_injection_failures": 0,
    "source_provenance_completeness": 1.0,
    "prohibited_for_training_flag_rate": 1.0,
}


def exact_agreement(labels_a: Sequence[str], labels_b: Sequence[str]) -> float:
    if len(labels_a) != len(labels_b) or not labels_a:
        raise ValueError("label_length_mismatch_or_empty")
    agree = sum(1 for a, b in zip(labels_a, labels_b) if a == b)
    return agree / len(labels_a)


def cohen_kappa(labels_a: Sequence[str], labels_b: Sequence[str]) -> float:
    """Cohen's kappa for categorical labels (known-vector tested)."""
    if len(labels_a) != len(labels_b) or not labels_a:
        raise ValueError("label_length_mismatch_or_empty")
    n = len(labels_a)
    cats = sorted(set(labels_a) | set(labels_b))
    po = exact_agreement(labels_a, labels_b)
    # expected agreement
    pe = 0.0
    for c in cats:
        pa = sum(1 for x in labels_a if x == c) / n
        pb = sum(1 for x in labels_b if x == c) / n
        pe += pa * pb
    if pe == 1.0:
        return 1.0
    return (po - pe) / (1.0 - pe)


def duplicate_consistency(pairs: Sequence[tuple[str, str]]) -> float:
    """Fraction of duplicate control pairs with identical labels."""
    if not pairs:
        return 1.0
    return sum(1 for a, b in pairs if a == b) / len(pairs)


def population_metric_status(*, numerator: int, denominator: int, required: bool) -> dict[str, Any]:
    if denominator == 0:
        if required:
            return {"status": "INVALID_REQUIRED_POPULATION", "value": None}
        return {"status": "NOT_APPLICABLE", "value": None}
    return {
        "status": "OK",
        "numerator": numerator,
        "denominator": denominator,
        "value": numerator / denominator,
    }


def reject_bulk_mapping(decision: dict[str, Any]) -> None:
    if decision.get("bulk_map") or decision.get("automatic_bulk_mapping"):
        raise ValueError("AUTOMATIC_BULK_MAPPING_REJECTED")


KNOWN_KAPPA_VECTOR = {
    "labels_a": ["A", "A", "B", "B", "A", "B", "A", "B", "A", "A"],
    "labels_b": ["A", "B", "B", "B", "A", "A", "A", "B", "A", "B"],
    # Hand-computed: po=0.7; pe=0.5*0.5+0.5*0.5=0.5; kappa=(0.7-0.5)/(0.5)=0.4
    "expected_kappa": 0.4,
    "expected_exact": 0.7,
}
