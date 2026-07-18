"""Independent R3N6 audit scorer and complete-chain comparators.

The audit target parser, expected-behavior formula, candidate projection, and
idempotence observation are implemented here.  This module deliberately does
not import the R3N6 canonical scorer or its target helper.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from .eval_mai07_r3n4_audit_scorer import (
    score_observations_audit as _score_observations_audit_r3n4,
)
from .r3n4_candidate_finalization import finalize_candidates_r3n4
from .r3n4_identity_anchor import IdentityAnchorError, create_identity_anchor
from .r3n6_scoring_contracts import (
    ALLOWED_EXPECTED_BEHAVIORS,
    CONTRACT_VERSION,
    FORMULA_VERSION,
    SCORER_VERSION,
    TARGET_AUTHORITY,
    bind_r3n6_report_identity,
    report_structure_mismatches,
    require_case_observation_bijection,
    require_exact_threshold_gate_spec,
    require_report_structure,
)


RUNTIME_VERSION = "mai-07.1.11-r3n6-chaincomplete"
SCORER_ID = "mai07_r3n6_independent_audit_scorer"
CANONICAL_SCORER_ID = "mai07_r3n6_canonical_scorer"

_BOUND_METADATA = {
    "scorer_version": SCORER_VERSION,
    "formula_version": FORMULA_VERSION,
    "scoring_contract_version": CONTRACT_VERSION,
}


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _has_dev(value: str) -> bool:
    return any(0x0900 <= ord(character) <= 0x097F for character in value)


def _target(case: dict[str, Any]) -> tuple[int, int, str] | None:
    """Independently validate the immutable R3N5 target-span field set."""

    try:
        raw = case["input_text"]
        start = case["target_start"]
        end = case["target_end_exclusive"]
        surface = case["target_raw_surface"]
        surface_digest = case["target_raw_surface_sha256"]
        source_digest = case["target_source_text_sha256"]
    except (KeyError, TypeError):
        return None
    if not isinstance(raw, str) or not isinstance(surface, str):
        return None
    if not isinstance(surface_digest, str) or not isinstance(source_digest, str):
        return None
    if isinstance(start, bool) or not isinstance(start, int):
        return None
    if isinstance(end, bool) or not isinstance(end, int):
        return None
    if case.get("target_schema_version") != "mai07_r3n5_target_span_v1":
        return None
    if case.get("target_offset_unit") != "UNICODE_CODE_POINT":
        return None
    if start < 0 or end <= start or end > len(raw):
        return None
    if raw[start:end] != surface or case.get("highlighted_span") != surface:
        return None
    if _sha(raw) != source_digest or _sha(surface) != surface_digest:
        return None
    return start, end, surface


def _span_matches_target(span: Any, target: tuple[int, int, str]) -> bool:
    try:
        return bool(
            int(span.raw_span.start_offset) == target[0]
            and int(span.raw_span.end_offset) == target[1]
            and span.raw_span.original_text == target[2]
        )
    except (AttributeError, TypeError, ValueError):
        return False


def _audit_projection(candidates: list[Any]) -> list[dict[str, Any]]:
    return [
        {
            "candidate_id": candidate.candidate_id,
            "surface": candidate.surface,
            "script": candidate.script.value,
            "kind": candidate.kind.value,
            "rank": int(candidate.rank),
            "ranking_score": f"{float(candidate.ranking_score):.6f}",
            "is_identity": bool(candidate.is_identity),
            "requires_review": bool(candidate.requires_review),
            "reason_codes": list(candidate.reason_codes or ()),
            "provenance": sorted(set(candidate.provenance or ())),
            "alignment": candidate.alignment.model_dump(mode="json"),
        }
        for candidate in candidates
    ]


def _serialization_ok(candidates: list[Any]) -> bool:
    if not candidates:
        return False
    projection = _audit_projection(candidates)
    try:
        encoded = json.dumps(
            projection,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        decoded = json.loads(encoded)
    except (TypeError, ValueError):
        return False
    return decoded == projection


def _audit_idempotent(
    anchor: Any, candidates: list[Any], raw_text: str
) -> bool:
    first, _, _ = finalize_candidates_r3n4(
        anchor, candidates, raw_text=raw_text
    )
    second, _, _ = finalize_candidates_r3n4(
        anchor, first, raw_text=raw_text
    )
    return _audit_projection(first) == _audit_projection(second)


def observe_case_audit(case: dict[str, Any], bundle: Any) -> dict[str, Any]:
    target = _target(case)
    runtime_valid = getattr(bundle, "runtime_version", None) == RUNTIME_VERSION
    span_results = tuple(getattr(bundle, "span_results", ()) or ())
    matches = (
        [
            span
            for span in span_results
            if _span_matches_target(span, target)
        ]
        if target is not None and runtime_valid
        else []
    )
    span = matches[0] if len(matches) == 1 else None
    candidates = list(span.candidates) if span is not None else []
    identities = [candidate for candidate in candidates if candidate.is_identity]
    top = candidates[0] if candidates else None
    exact_raw = bool(
        target is not None
        and any(candidate.surface == target[2] for candidate in identities)
    )
    reasons = (
        set(getattr(span, "decision_reason_codes", ()) or ())
        if span is not None
        else set()
    )
    path_finalized = bool(
        span is not None
        and (
            "R3N4_ANCHOR_FINALIZED" in reasons
            or any(
                "r3n4_anchor_reserved" in (candidate.provenance or ())
                for candidate in candidates
            )
        )
    )

    anchor_valid = False
    finalizer_idempotent = False
    if span is not None and target is not None and candidates:
        try:
            anchor = create_identity_anchor(
                case["input_text"],
                raw_start=target[0],
                raw_end_exclusive=target[1],
                anchor_kind="R3N6_INDEPENDENT_AUDIT",
                created_from="eval_mai07_r3n6_audit_scorer.observe_case_audit",
            )
            anchor_valid = bool(
                exact_raw and anchor.raw_surface == target[2]
            )
            finalizer_idempotent = _audit_idempotent(
                anchor, candidates, case["input_text"]
            )
        except IdentityAnchorError:
            pass

    return {
        "case_id": case["case_id"],
        "populations": list(
            case.get("populations") or case.get("population_ids") or []
        ),
        "expected_behavior": case.get("expected_behavior"),
        "span_found": span is not None,
        "identity_top1": bool(top and top.is_identity),
        "identity_retained": bool(identities),
        "exact_raw_identity": exact_raw,
        "exactly_one_identity": len(identities) == 1,
        "finalizer_idempotence": finalizer_idempotent,
        "serialization_roundtrip": _serialization_ok(candidates),
        "path_finalized": path_finalized,
        "anchor_valid": anchor_valid,
        "false_devanagari_top1": bool(
            top and not top.is_identity and _has_dev(top.surface)
        ),
        "devanagari_at_5": any(
            not candidate.is_identity and _has_dev(candidate.surface)
            for candidate in candidates[:5]
        ),
        "raw_text_unchanged": target is not None,
        "caps_ok": bool(
            runtime_valid
            and all(len(result.candidates) <= 5 for result in span_results)
        ),
        "candidate_count": len(candidates),
        "target_contract_valid": target is not None,
        "runtime_contract_valid": runtime_valid,
    }


def _passes_expected_audit(observation: dict[str, Any]) -> bool:
    """Independent audit expression for a case's declared expectation."""

    behavior = observation.get("expected_behavior")
    if behavior not in ALLOWED_EXPECTED_BEHAVIORS:
        return False
    found = observation.get("span_found") is True
    exact = observation.get("exact_raw_identity") is True
    if behavior in {
        "IDENTITY_TOP1",
        "ACRONYM_IDENTITY_TOP1",
        "PROTECTED_IDENTITY",
    }:
        return bool(
            found
            and observation.get("identity_top1") is True
            and observation.get("false_devanagari_top1") is not True
        )
    if behavior in {"IDENTITY_RETAINED", "SHARED_CONSERVATIVE"}:
        return bool(found and exact)
    if behavior == "ROMANIZED_SCRIPT_AT_5":
        return bool(found and observation.get("devanagari_at_5") is True)
    if behavior in {"NO_RAW_MUTATION", "CAP_OK"}:
        return bool(
            exact
            and observation.get("raw_text_unchanged") is True
            and observation.get("caps_ok") is True
        )
    # The independent formula intentionally has no permissive fallback.
    return False


def _audit_split_expected_metric(
    cases: list[dict[str, Any]],
    observations: list[dict[str, Any]],
    *,
    split: str,
) -> dict[str, Any]:
    indexed: dict[str, dict[str, Any]] = {}
    for observation in observations:
        if not isinstance(observation, dict):
            continue
        case_id = observation.get("case_id")
        if isinstance(case_id, str):
            indexed[case_id] = observation
    case_ids = [case.get("case_id") for case in cases]
    successes = 0
    for case_id in case_ids:
        if isinstance(case_id, str) and _passes_expected_audit(
            indexed.get(case_id, {})
        ):
            successes += 1
    total = len(case_ids)
    return {
        "metric_id": "split_expected_pass",
        "population_id": f"SPLIT_{split}",
        "numerator": successes,
        "denominator": total,
        "applicability": (
            "APPLICABLE" if total else "INVALID_REQUIRED_POPULATION"
        ),
        "value": (successes / total) if total else None,
        "threshold": 1.0,
        "operation": "==",
        "integer_required": False,
        "notes": "",
    }


def score_observations_audit(
    cases: list[dict[str, Any]],
    observations: list[dict[str, Any]],
    *,
    thresholds: dict[str, Any],
    split: str = "DEVELOPMENT",
) -> dict[str, Any]:
    require_exact_threshold_gate_spec(thresholds)
    require_case_observation_bijection(cases, observations, side="audit")
    report = _score_observations_audit_r3n4(
        cases, observations, thresholds=thresholds, split=split
    )
    report["metrics"] = dict(report.get("metrics", {}))
    report["metrics"]["split_expected_pass"] = _audit_split_expected_metric(
        cases, observations, split=split
    )
    report["split"] = split
    # Audit evidence must remain inspectable in the persisted audit report.
    report["observations"] = observations
    bound = bind_r3n6_report_identity(report, scorer_id=SCORER_ID)
    require_report_structure(
        bound,
        side="audit",
        expected_case_ids=[case["case_id"] for case in cases],
    )
    return bound


def _append_once(mismatches: list[str], value: str) -> None:
    if value not in mismatches:
        mismatches.append(value)


def _compare_complete_mapping(
    prefix: str,
    canonical: dict[str, Any],
    audit: dict[str, Any],
    mismatches: list[str],
) -> None:
    if set(canonical) != set(audit):
        _append_once(mismatches, f"{prefix}.keyset")
    for key in sorted(set(canonical) | set(audit)):
        if key not in canonical or key not in audit:
            _append_once(mismatches, f"{prefix}.{key}.missing")
            continue
        canonical_value = canonical[key]
        audit_value = audit[key]
        if isinstance(canonical_value, dict) and isinstance(audit_value, dict):
            _compare_complete_mapping(
                f"{prefix}.{key}", canonical_value, audit_value, mismatches
            )
        elif canonical_value != audit_value:
            _append_once(mismatches, f"{prefix}.{key}")


def _validate_bound_metadata(
    side: str, report: dict[str, Any], mismatches: list[str]
) -> None:
    for key, expected in _BOUND_METADATA.items():
        if report.get(key) != expected:
            _append_once(mismatches, f"{side}.report.{key}")
    if report.get("target_authority") != TARGET_AUTHORITY:
        _append_once(mismatches, f"{side}.report.target_authority")

    metrics = report.get("metrics")
    if not isinstance(metrics, dict):
        _append_once(mismatches, f"{side}.metrics.invalid")
        metrics = {}
    for metric_id, metric in metrics.items():
        if not isinstance(metric, dict):
            _append_once(mismatches, f"{side}.metric.{metric_id}.invalid")
            continue
        for key, expected in _BOUND_METADATA.items():
            if metric.get(key) != expected:
                _append_once(
                    mismatches, f"{side}.metric.{metric_id}.{key}"
                )

    gates = report.get("gates")
    if not isinstance(gates, dict):
        _append_once(mismatches, f"{side}.gates.invalid")
        gates = {}
    for gate_id, gate in gates.items():
        if not isinstance(gate, dict):
            _append_once(mismatches, f"{side}.gate.{gate_id}.invalid")
            continue
        for key, expected in _BOUND_METADATA.items():
            if gate.get(key) != expected:
                _append_once(mismatches, f"{side}.gate.{gate_id}.{key}")
        nested = gate.get("metric")
        if not isinstance(nested, dict):
            _append_once(mismatches, f"{side}.gate.{gate_id}.metric.invalid")
            continue
        for key, expected in _BOUND_METADATA.items():
            if nested.get(key) != expected:
                _append_once(
                    mismatches, f"{side}.gate.{gate_id}.metric.{key}"
                )


def compare_canonical_audit(
    canonical: dict[str, Any], audit: dict[str, Any]
) -> dict[str, Any]:
    """Compare every metric and gate, including ``split_expected_pass``."""

    mismatches: list[str] = []
    if canonical.get("scorer_id") != CANONICAL_SCORER_ID:
        _append_once(mismatches, "canonical.report.scorer_id")
    if audit.get("scorer_id") != SCORER_ID:
        _append_once(mismatches, "audit.report.scorer_id")
    if canonical.get("scorer_id") == audit.get("scorer_id"):
        _append_once(mismatches, "scorer_ids_not_independent")

    for mismatch in report_structure_mismatches(
        canonical, side="canonical"
    ):
        _append_once(mismatches, mismatch)
    for mismatch in report_structure_mismatches(audit, side="audit"):
        _append_once(mismatches, mismatch)

    _validate_bound_metadata("canonical", canonical, mismatches)
    _validate_bound_metadata("audit", audit, mismatches)

    canonical_metrics = canonical.get("metrics", {})
    audit_metrics = audit.get("metrics", {})
    if not isinstance(canonical_metrics, dict):
        canonical_metrics = {}
    if not isinstance(audit_metrics, dict):
        audit_metrics = {}
    if set(canonical_metrics) != set(audit_metrics):
        _append_once(mismatches, "metric_keyset")
    for metric_id in sorted(set(canonical_metrics) | set(audit_metrics)):
        canonical_metric = canonical_metrics.get(metric_id)
        audit_metric = audit_metrics.get(metric_id)
        if not isinstance(canonical_metric, dict) or not isinstance(
            audit_metric, dict
        ):
            _append_once(mismatches, f"metric.{metric_id}.missing")
            continue
        _compare_complete_mapping(
            f"metric.{metric_id}",
            canonical_metric,
            audit_metric,
            mismatches,
        )

    canonical_gates = canonical.get("gates", {})
    audit_gates = audit.get("gates", {})
    if not isinstance(canonical_gates, dict):
        canonical_gates = {}
    if not isinstance(audit_gates, dict):
        audit_gates = {}
    if set(canonical_gates) != set(audit_gates):
        _append_once(mismatches, "gate_keyset")
    for gate_id in sorted(set(canonical_gates) | set(audit_gates)):
        canonical_gate = canonical_gates.get(gate_id)
        audit_gate = audit_gates.get(gate_id)
        if not isinstance(canonical_gate, dict) or not isinstance(
            audit_gate, dict
        ):
            _append_once(mismatches, f"gate.{gate_id}.missing")
            continue
        _compare_complete_mapping(
            f"gate.{gate_id}", canonical_gate, audit_gate, mismatches
        )

    if canonical.get("ok") != audit.get("ok"):
        _append_once(mismatches, "report.ok")
    if canonical.get("failed_gates") != audit.get("failed_gates"):
        _append_once(mismatches, "report.failed_gates")

    canonical_observations = canonical.get("observations")
    audit_observations = audit.get("observations")
    if not isinstance(canonical_observations, list):
        canonical_observations = []
    if not isinstance(audit_observations, list):
        audit_observations = []
    observation_agreement = compare_case_observations(
        canonical_observations, audit_observations
    )
    for mismatch in observation_agreement["mismatches"]:
        _append_once(mismatches, f"report.observations.{mismatch}")
    return {"ok": not mismatches, "mismatches": mismatches}


_CASE_FIELDS = (
    "populations",
    "expected_behavior",
    "target_contract_valid",
    "runtime_contract_valid",
    "span_found",
    "identity_top1",
    "identity_retained",
    "exact_raw_identity",
    "exactly_one_identity",
    "finalizer_idempotence",
    "serialization_roundtrip",
    "path_finalized",
    "anchor_valid",
    "false_devanagari_top1",
    "devanagari_at_5",
    "raw_text_unchanged",
    "caps_ok",
    "candidate_count",
)


def _index_case_observations(
    rows: list[dict[str, Any]], side: str, mismatches: list[str]
) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for position, row in enumerate(rows):
        if not isinstance(row, dict) or not isinstance(row.get("case_id"), str):
            _append_once(mismatches, f"{side}.case_id.invalid:{position}")
            continue
        case_id = row["case_id"]
        if case_id in indexed:
            _append_once(mismatches, f"{side}.duplicate_case_id:{case_id}")
        indexed[case_id] = row
    return indexed


def compare_case_observations(
    canonical: list[dict[str, Any]], audit: list[dict[str, Any]]
) -> dict[str, Any]:
    mismatches: list[str] = []
    if len(canonical) != len(audit):
        _append_once(mismatches, "observation_count")
    canonical_by_id = _index_case_observations(
        canonical, "canonical", mismatches
    )
    audit_by_id = _index_case_observations(audit, "audit", mismatches)
    if set(canonical_by_id) != set(audit_by_id):
        _append_once(mismatches, "case_id_bijection")

    missing = object()
    for case_id in sorted(set(canonical_by_id) & set(audit_by_id)):
        canonical_row = canonical_by_id[case_id]
        audit_row = audit_by_id[case_id]
        for field in _CASE_FIELDS:
            canonical_value = canonical_row.get(field, missing)
            audit_value = audit_row.get(field, missing)
            if canonical_value is missing or audit_value is missing:
                _append_once(mismatches, f"{case_id}.{field}.missing")
            elif canonical_value != audit_value:
                _append_once(mismatches, f"{case_id}.{field}")
    return {"ok": not mismatches, "mismatches": mismatches}


__all__ = [
    "compare_canonical_audit",
    "compare_case_observations",
    "observe_case_audit",
    "score_observations_audit",
]
