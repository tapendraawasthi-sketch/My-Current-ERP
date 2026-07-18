"""Versioned R3N5 scoring identity layered over proven population arithmetic."""

from __future__ import annotations

from typing import Any

SCORER_VERSION = "mai-07-r3n5.scorer.1.0.0"
FORMULA_VERSION = "mai-07-r3n5.formula.1.0.0"
CONTRACT_VERSION = "mai-07-r3n5.contract.1.0.0"

MINIMUM_DENOMINATORS = {
    "ENGLISH_IDENTITY_REQUIRED": 200,
    "ROMANIZED_NEPALI_REQUIRED": 200,
    "IDENTITY_RETENTION_REQUIRED": 850,
    "EXACT_RAW_IDENTITY_REQUIRED": 850,
    "EXACTLY_ONE_IDENTITY_REQUIRED": 850,
    "FINALIZER_IDEMPOTENCE_REQUIRED": 2475,
    "IDENTITY_INVARIANT_ANALOGUE": 350,
    "CANDIDATE_CAP_PRESSURE": 350,
    "MULTI_TOKEN_IDENTITY": 300,
    "REFINED_SPAN_IDENTITY": 200,
    "COALESCED_SPAN_IDENTITY": 200,
    "SERIALIZATION_ROUNDTRIP": 500,
    "UNICODE_IDENTITY": 150,
    "ACRONYM_IDENTITY_REQUIRED": 100,
    "IDENTIFIER_PROTECTION_REQUIRED": 100,
    "PROTECTED_IDENTITY_REQUIRED": 100,
    "SHARED_OR_AMBIGUOUS": 150,
    "ENGLISH_GUARD_ANALOGUE": 100,
    "ACRONYM_IDENTIFIER_ANALOGUE": 75,
    "CONTEXT_COUNTERFACTUAL": 300,
    "OOV": 100,
    "MONOTONIC_PARENT_CORRECT": 400,
    "IDENTITY_ANCHOR_CHALLENGE": 500,
}

REQUIRED_POPULATIONS = tuple(MINIMUM_DENOMINATORS)


def bind_r3n5_report_identity(report: dict[str, Any], *, scorer_id: str) -> dict[str, Any]:
    bound = dict(report)
    bound["scorer_id"] = scorer_id
    bound["scorer_version"] = SCORER_VERSION
    bound["formula_version"] = FORMULA_VERSION
    bound["scoring_contract_version"] = CONTRACT_VERSION
    bound["target_authority"] = "IMMUTABLE_RAW_CODE_POINT_INTERVAL"
    metrics = {}
    for metric_id, metric in report.get("metrics", {}).items():
        row = dict(metric)
        row["formula_version"] = FORMULA_VERSION
        metrics[metric_id] = row
    bound["metrics"] = metrics
    return bound


__all__ = [
    "CONTRACT_VERSION", "FORMULA_VERSION", "MINIMUM_DENOMINATORS",
    "REQUIRED_POPULATIONS", "SCORER_VERSION", "bind_r3n5_report_identity",
]
