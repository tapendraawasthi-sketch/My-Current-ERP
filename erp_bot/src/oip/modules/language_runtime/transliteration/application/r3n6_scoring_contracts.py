"""R3N6 scoring identity and report-binding contracts.

R3N6 keeps the proven R3N4 population arithmetic and the R3N5 target-span
authority, but closes the report-chain gap: every metric, every gate, and every
metric nested in a gate is explicitly bound to the R3N6 scorer, formula, and
contract versions.
"""

from __future__ import annotations

from typing import Any


SCORER_VERSION = "mai-07-r3n6.scorer.1.0.0"
FORMULA_VERSION = "mai-07-r3n6.formula.1.0.0"
CONTRACT_VERSION = "mai-07-r3n6.contract.1.0.0"
TARGET_AUTHORITY = "IMMUTABLE_RAW_CODE_POINT_INTERVAL"

# These are the only declarations understood by either R3N6 expected-behavior
# formula.  The scorers deliberately keep their formula implementations
# separate; this shared allow-list only binds the accepted vocabulary.
ALLOWED_EXPECTED_BEHAVIORS = frozenset(
    {
        "ACRONYM_IDENTITY_TOP1",
        "CAP_OK",
        "IDENTITY_RETAINED",
        "IDENTITY_TOP1",
        "NO_RAW_MUTATION",
        "PROTECTED_IDENTITY",
        "ROMANIZED_SCRIPT_AT_5",
        "SHARED_CONSERVATIVE",
    }
)

# This is the complete, source-locked gate input accepted by R3N6.  R3N4's
# scorer has defaults for absent entries; allowing those defaults here would
# make a symmetrically incomplete threshold file appear valid.
REQUIRED_GATE_SPEC: dict[str, dict[str, str | float]] = {
    "english_identity_top1": {"op": ">=", "value": 0.98},
    "false_devanagari_on_english": {"op": "<=", "value": 0.02},
    "romanized_script_at_5": {"op": ">=", "value": 0.95},
    "identity_retention": {"op": "==", "value": 1.0},
    "identity_invariant_analogue": {"op": "==", "value": 1.0},
    "cap_pressure_identity_retention": {"op": "==", "value": 1.0},
    "exact_raw_identity": {"op": "==", "value": 1.0},
    "exactly_one_identity": {"op": "==", "value": 1.0},
    "finalizer_idempotence": {"op": "==", "value": 1.0},
    "serialization_roundtrip": {"op": "==", "value": 1.0},
    "path_finalization_coverage": {"op": "==", "value": 1.0},
    "anchor_validity": {"op": "==", "value": 1.0},
    "multi_token_identity": {"op": "==", "value": 1.0},
    "refined_span_identity": {"op": "==", "value": 1.0},
    "coalesced_span_identity": {"op": "==", "value": 1.0},
    "unicode_identity": {"op": "==", "value": 1.0},
    "acronym_identity_top1": {"op": "==", "value": 1.0},
    "identifier_identity_top1": {"op": "==", "value": 1.0},
    "protected_identity": {"op": "==", "value": 1.0},
    "authorized_code_corrective": {"op": "==", "value": 1.0},
    "caps_ok": {"op": "==", "value": 1.0},
    "raw_ok_all": {"op": "==", "value": 1.0},
    "english_guard_analogue": {"op": ">=", "value": 0.98},
    "acronym_identifier_analogue": {"op": "==", "value": 1.0},
}

# R3N4 emits two additional population-specific metrics/gates from the
# exact-identity settings.  This explicit keyset is the authoritative R3N6
# report schema; agreement between two smaller reports is not sufficient.
REQUIRED_METRIC_KEYS = frozenset(
    {
        "acronym_identifier_analogue",
        "acronym_identity_top1",
        "anchor_validity",
        "authorized_code_corrective",
        "cap_pressure_identity_retention",
        "caps_ok",
        "coalesced_span_identity",
        "english_guard_analogue",
        "english_identity_top1",
        "exact_raw_identity",
        "exact_raw_identity_required",
        "exactly_one_identity",
        "exactly_one_identity_required",
        "false_devanagari_on_english",
        "finalizer_idempotence",
        "identifier_identity_top1",
        "identity_invariant_analogue",
        "identity_retention",
        "multi_token_identity",
        "path_finalization_coverage",
        "protected_identity",
        "raw_ok_all",
        "refined_span_identity",
        "romanized_script_at_5",
        "serialization_roundtrip",
        "split_expected_pass",
        "unicode_identity",
    }
)

REQUIRED_REPORT_GATE_KEYS = frozenset(
    {
        "acronym_identifier_analogue",
        "acronym_identity_top1",
        "anchor_validity",
        "authorized_code_corrective",
        "cap_pressure_identity_retention",
        "caps_ok",
        "coalesced_span_identity",
        "english_guard_analogue",
        "english_identity_top1",
        "exact_raw_identity",
        "exact_raw_identity_required",
        "exactly_one_identity",
        "exactly_one_identity_required",
        "false_devanagari_on_english",
        "finalizer_idempotence",
        "identifier_identity_top1",
        "identity_invariant_analogue",
        "identity_retention",
        "multi_token_identity",
        "path_finalization_coverage",
        "protected_identity",
        "raw_ok_all",
        "refined_span_identity",
        "romanized_script_at_5",
        "serialization_roundtrip",
        "unicode_identity",
    }
)

_REPORT_GATE_SOURCE = {
    "exact_raw_identity_required": "exact_raw_identity",
    "exactly_one_identity_required": "exactly_one_identity",
}


class ScoringContractError(ValueError):
    """Raised when R3N6 scoring evidence is structurally incomplete."""


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

_VERSION_METADATA = {
    "scorer_version": SCORER_VERSION,
    "formula_version": FORMULA_VERSION,
    "scoring_contract_version": CONTRACT_VERSION,
}


def require_exact_threshold_gate_spec(thresholds: dict[str, Any]) -> None:
    """Reject every threshold gate set except the source-locked R3N6 spec."""

    if not isinstance(thresholds, dict):
        raise ScoringContractError("r3n6_thresholds_not_mapping")
    gates = thresholds.get("gates")
    if not isinstance(gates, dict):
        raise ScoringContractError("r3n6_threshold_gates_not_mapping")
    if set(gates) != set(REQUIRED_GATE_SPEC):
        raise ScoringContractError("r3n6_threshold_gate_keyset_mismatch")
    for gate_id, expected in REQUIRED_GATE_SPEC.items():
        actual = gates.get(gate_id)
        if not isinstance(actual, dict) or set(actual) != {"op", "value"}:
            raise ScoringContractError(
                f"r3n6_threshold_gate_shape_mismatch:{gate_id}"
            )
        if actual.get("op") != expected["op"]:
            raise ScoringContractError(
                f"r3n6_threshold_gate_operation_mismatch:{gate_id}"
            )
        value = actual.get("value")
        if isinstance(value, bool) or not isinstance(value, float):
            raise ScoringContractError(
                f"r3n6_threshold_gate_value_type_mismatch:{gate_id}"
            )
        if value != expected["value"]:
            raise ScoringContractError(
                f"r3n6_threshold_gate_value_mismatch:{gate_id}"
            )


def _row_ids(
    rows: Any, *, side: str, mismatches: list[str]
) -> list[str]:
    if not isinstance(rows, list):
        mismatches.append(f"{side}.not_list")
        return []
    ids: list[str] = []
    for position, row in enumerate(rows):
        if not isinstance(row, dict):
            mismatches.append(f"{side}.row.invalid:{position}")
            continue
        case_id = row.get("case_id")
        if not isinstance(case_id, str) or not case_id:
            mismatches.append(f"{side}.case_id.invalid:{position}")
            continue
        ids.append(case_id)
    if len(ids) != len(set(ids)):
        mismatches.append(f"{side}.case_id.duplicate")
    return ids


def observation_persistence_status(
    cases: list[dict[str, Any]],
    canonical_observations: Any,
    audit_observations: Any,
) -> dict[str, Any]:
    """Validate exact count, uniqueness, and case-ID bijection on both sides."""

    mismatches: list[str] = []
    case_ids = _row_ids(cases, side="cases", mismatches=mismatches)
    canonical_ids = _row_ids(
        canonical_observations,
        side="canonical_observations",
        mismatches=mismatches,
    )
    audit_ids = _row_ids(
        audit_observations,
        side="audit_observations",
        mismatches=mismatches,
    )

    expected_count = len(cases) if isinstance(cases, list) else 0
    canonical_count = (
        len(canonical_observations)
        if isinstance(canonical_observations, list)
        else 0
    )
    audit_count = (
        len(audit_observations)
        if isinstance(audit_observations, list)
        else 0
    )
    if canonical_count != expected_count:
        mismatches.append("canonical_observations.count")
    if audit_count != expected_count:
        mismatches.append("audit_observations.count")
    if len(case_ids) != expected_count:
        mismatches.append("cases.valid_id_count")
    if len(canonical_ids) != canonical_count:
        mismatches.append("canonical_observations.valid_id_count")
    if len(audit_ids) != audit_count:
        mismatches.append("audit_observations.valid_id_count")
    if set(canonical_ids) != set(case_ids):
        mismatches.append("canonical_observations.case_id_bijection")
    if set(audit_ids) != set(case_ids):
        mismatches.append("audit_observations.case_id_bijection")
    if set(canonical_ids) != set(audit_ids):
        mismatches.append("canonical_audit.case_id_bijection")

    # Preserve deterministic, non-repeating diagnostics in persisted evidence.
    unique_mismatches = list(dict.fromkeys(mismatches))
    return {
        "ok": not unique_mismatches,
        "expected_count": expected_count,
        "canonical_count": canonical_count,
        "audit_count": audit_count,
        "mismatches": unique_mismatches,
    }


def require_case_observation_bijection(
    cases: list[dict[str, Any]],
    observations: list[dict[str, Any]],
    *,
    side: str,
) -> None:
    """Fail before scoring when observations are not a case-exact bijection."""

    if side not in {"canonical", "audit"}:
        raise ScoringContractError(f"invalid_observation_side:{side}")
    empty_other: list[dict[str, Any]] = list(cases)
    status = (
        observation_persistence_status(cases, observations, empty_other)
        if side == "canonical"
        else observation_persistence_status(cases, empty_other, observations)
    )
    relevant_prefix = f"{side}_observations"
    relevant = [
        mismatch
        for mismatch in status["mismatches"]
        if mismatch.startswith(relevant_prefix)
        or mismatch.startswith("cases.")
    ]
    if relevant:
        raise ScoringContractError(
            f"r3n6_{side}_observation_bijection_invalid:"
            + ",".join(relevant)
        )


def report_structure_mismatches(
    report: dict[str, Any], *, side: str
) -> list[str]:
    """Return strict R3N6 report-schema and persisted-observation failures."""

    mismatches: list[str] = []
    metrics = report.get("metrics")
    if not isinstance(metrics, dict):
        mismatches.append(f"{side}.metrics.invalid")
        metrics = {}
    if set(metrics) != set(REQUIRED_METRIC_KEYS):
        mismatches.append(f"{side}.metrics.required_keyset")

    gates = report.get("gates")
    if not isinstance(gates, dict):
        mismatches.append(f"{side}.gates.invalid")
        gates = {}
    if set(gates) != set(REQUIRED_REPORT_GATE_KEYS):
        mismatches.append(f"{side}.gates.required_keyset")

    for metric_id in sorted(REQUIRED_METRIC_KEYS & set(metrics)):
        metric = metrics[metric_id]
        if not isinstance(metric, dict):
            mismatches.append(f"{side}.metric.{metric_id}.invalid")
            continue
        if metric.get("metric_id") != metric_id:
            mismatches.append(f"{side}.metric.{metric_id}.metric_id")
        if metric_id == "split_expected_pass":
            expected_spec = {"op": "==", "value": 1.0}
        else:
            source_id = _REPORT_GATE_SOURCE.get(metric_id, metric_id)
            expected_spec = REQUIRED_GATE_SPEC[source_id]
        if metric.get("operation") != expected_spec["op"]:
            mismatches.append(f"{side}.metric.{metric_id}.operation")
        if metric.get("threshold") != expected_spec["value"]:
            mismatches.append(f"{side}.metric.{metric_id}.threshold")

    for gate_id in sorted(REQUIRED_REPORT_GATE_KEYS & set(gates)):
        gate = gates[gate_id]
        if not isinstance(gate, dict):
            mismatches.append(f"{side}.gate.{gate_id}.invalid")
            continue
        if gate.get("metric_id") != gate_id:
            mismatches.append(f"{side}.gate.{gate_id}.metric_id")
        nested = gate.get("metric")
        if not isinstance(nested, dict):
            mismatches.append(f"{side}.gate.{gate_id}.metric.invalid")
        elif isinstance(metrics.get(gate_id), dict) and nested != metrics[gate_id]:
            mismatches.append(f"{side}.gate.{gate_id}.metric_projection")

    observations = report.get("observations")
    observation_ids = _row_ids(
        observations,
        side=f"{side}.observations",
        mismatches=mismatches,
    )
    split_metric = metrics.get("split_expected_pass")
    denominator = (
        split_metric.get("denominator")
        if isinstance(split_metric, dict)
        else None
    )
    if (
        isinstance(denominator, bool)
        or not isinstance(denominator, int)
        or denominator < 0
    ):
        mismatches.append(f"{side}.observations.expected_count.invalid")
    elif not isinstance(observations, list) or len(observations) != denominator:
        mismatches.append(f"{side}.observations.count")
    if isinstance(observations, list) and len(observation_ids) != len(observations):
        mismatches.append(f"{side}.observations.valid_id_count")
    return list(dict.fromkeys(mismatches))


def require_report_structure(
    report: dict[str, Any],
    *,
    side: str,
    expected_case_ids: list[str],
) -> None:
    mismatches = report_structure_mismatches(report, side=side)
    observations = report.get("observations")
    actual_ids = (
        [row.get("case_id") for row in observations]
        if isinstance(observations, list)
        and all(isinstance(row, dict) for row in observations)
        else []
    )
    if len(actual_ids) != len(expected_case_ids):
        mismatches.append(f"{side}.observations.expected_count")
    if set(actual_ids) != set(expected_case_ids):
        mismatches.append(f"{side}.observations.case_id_bijection")
    if mismatches:
        raise ScoringContractError(
            "r3n6_report_structure_invalid:" + ",".join(dict.fromkeys(mismatches))
        )


def _bind_row(row: dict[str, Any]) -> dict[str, Any]:
    bound = dict(row)
    bound.update(_VERSION_METADATA)
    return bound


def bind_r3n6_report_identity(
    report: dict[str, Any], *, scorer_id: str
) -> dict[str, Any]:
    """Return a report whose complete scoring tree carries R3N6 identity.

    Some predecessor gates omit their nested metric when a population is
    empty.  R3N6 restores that metric from the report metric map so all gate
    outcomes retain the arithmetic and population semantics they evaluated.
    """

    bound = dict(report)
    bound.update(_VERSION_METADATA)
    bound["scorer_id"] = scorer_id
    bound["target_authority"] = TARGET_AUTHORITY

    metrics: dict[str, dict[str, Any]] = {}
    for metric_id, metric in report.get("metrics", {}).items():
        metrics[metric_id] = _bind_row(metric)
    bound["metrics"] = metrics

    gates: dict[str, dict[str, Any]] = {}
    for gate_id, gate in report.get("gates", {}).items():
        row = _bind_row(gate)
        nested = gate.get("metric")
        if isinstance(nested, dict):
            row["metric"] = _bind_row(nested)
        elif gate_id in metrics:
            row["metric"] = dict(metrics[gate_id])
        gates[gate_id] = row
    bound["gates"] = gates
    return bound


__all__ = [
    "ALLOWED_EXPECTED_BEHAVIORS",
    "CONTRACT_VERSION",
    "FORMULA_VERSION",
    "MINIMUM_DENOMINATORS",
    "REQUIRED_GATE_SPEC",
    "REQUIRED_METRIC_KEYS",
    "REQUIRED_POPULATIONS",
    "REQUIRED_REPORT_GATE_KEYS",
    "SCORER_VERSION",
    "ScoringContractError",
    "TARGET_AUTHORITY",
    "bind_r3n6_report_identity",
    "observation_persistence_status",
    "report_structure_mismatches",
    "require_case_observation_bijection",
    "require_exact_threshold_gate_spec",
    "require_report_structure",
]
