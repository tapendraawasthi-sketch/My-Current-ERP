"""Independent R3N5 audit observations.

This module deliberately does not import the R3N5 canonical scorer or target
contract. It reconstructs and validates target authority directly from case
fields, then delegates only population arithmetic to the established independent
R3N4 audit scorer.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from .eval_mai07_r3n4_audit_scorer import score_observations_audit as _score_observations_audit_r3n4
from .r3n4_candidate_finalization import finalize_candidates_r3n4
from .r3n4_identity_anchor import IdentityAnchorError, create_identity_anchor
from .r3n5_scoring_contracts import bind_r3n5_report_identity


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _has_dev(value: str) -> bool:
    return any(0x0900 <= ord(ch) <= 0x097F for ch in value)


def _target(case: dict[str, Any]) -> tuple[int, int, str] | None:
    try:
        raw = case["input_text"]
        start = case["target_start"]
        end = case["target_end_exclusive"]
        surface = case["target_raw_surface"]
    except KeyError:
        return None
    if not isinstance(raw, str) or not isinstance(surface, str):
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
    if _sha(raw) != case.get("target_source_text_sha256"):
        return None
    if _sha(surface) != case.get("target_raw_surface_sha256"):
        return None
    return start, end, surface


def _serialization_ok(candidates: list[Any]) -> bool:
    if not candidates:
        return False
    projection = _audit_projection(candidates)
    try:
        encoded = json.dumps(projection, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        rows = json.loads(encoded)
    except (TypeError, ValueError):
        return False
    return rows == projection


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


def _audit_idempotent(anchor: Any, candidates: list[Any], raw_text: str) -> bool:
    first, _, _ = finalize_candidates_r3n4(anchor, candidates, raw_text=raw_text)
    second, _, _ = finalize_candidates_r3n4(anchor, first, raw_text=raw_text)
    return _audit_projection(first) == _audit_projection(second)


def observe_case_audit(case: dict[str, Any], bundle: Any) -> dict[str, Any]:
    target = _target(case)
    runtime_valid = getattr(bundle, "runtime_version", None) == "mai-07.1.10-r3n5-targetspan"
    matches = []
    if target is not None and runtime_valid:
        start, end, surface = target
        matches = [
            span
            for span in bundle.span_results
            if int(span.raw_span.start_offset) == start
            and int(span.raw_span.end_offset) == end
            and span.raw_span.original_text == surface
        ]
    span = matches[0] if len(matches) == 1 else None
    candidates = list(span.candidates) if span is not None else []
    identities = [candidate for candidate in candidates if candidate.is_identity]
    top = candidates[0] if candidates else None
    exact = bool(
        target is not None and any(candidate.surface == target[2] for candidate in identities)
    )
    reasons = set(getattr(span, "decision_reason_codes", ()) or ()) if span is not None else set()
    path_finalized = bool(
        span is not None
        and (
            "R3N4_ANCHOR_FINALIZED" in reasons
            or any("r3n4_anchor_reserved" in (candidate.provenance or ()) for candidate in candidates)
        )
    )
    anchor_valid = False
    idempotent = False
    if span is not None and target is not None and candidates:
        try:
            anchor = create_identity_anchor(
                case["input_text"],
                raw_start=target[0],
                raw_end_exclusive=target[1],
                anchor_kind="R3N5_INDEPENDENT_AUDIT",
                created_from="eval_mai07_r3n5_audit_scorer.observe_case_audit",
            )
            anchor_valid = exact and anchor.raw_surface == target[2]
            idempotent = _audit_idempotent(anchor, candidates, case["input_text"])
        except IdentityAnchorError:
            pass
    return {
        "case_id": case["case_id"],
        "populations": list(case.get("population_ids") or []),
        "span_found": span is not None,
        "identity_top1": bool(top and top.is_identity),
        "identity_retained": bool(identities),
        "exact_raw_identity": exact,
        "exactly_one_identity": len(identities) == 1,
        "finalizer_idempotence": idempotent,
        "serialization_roundtrip": _serialization_ok(candidates),
        "path_finalized": path_finalized,
        "anchor_valid": anchor_valid,
        "false_devanagari_top1": bool(top and not top.is_identity and _has_dev(top.surface)),
        "devanagari_at_5": any(not c.is_identity and _has_dev(c.surface) for c in candidates[:5]),
        "raw_text_unchanged": target is not None,
        "caps_ok": all(len(result.candidates) <= 5 for result in bundle.span_results),
        "candidate_count": len(candidates),
        "target_contract_valid": target is not None,
        "runtime_contract_valid": runtime_valid,
    }


def score_observations_audit(
    cases: list[dict[str, Any]], observations: list[dict[str, Any]], *, thresholds: dict[str, Any], split: str = "DEVELOPMENT"
) -> dict[str, Any]:
    report = _score_observations_audit_r3n4(
        cases, observations, thresholds=thresholds, split=split
    )
    return bind_r3n5_report_identity(report, scorer_id="mai07_r3n5_independent_audit_scorer")


def compare_canonical_audit(canonical: dict[str, Any], audit: dict[str, Any]) -> dict[str, Any]:
    mismatches: list[str] = []
    if canonical.get("scorer_id") == audit.get("scorer_id"):
        mismatches.append("scorer_ids_not_independent")
    for key in ("scorer_version", "formula_version", "scoring_contract_version", "target_authority"):
        if canonical.get(key) != audit.get(key):
            mismatches.append(f"report.{key}")
    canonical_metrics = canonical.get("metrics", {})
    audit_metrics = audit.get("metrics", {})
    ignored_metrics = {"split_expected_pass"}
    if set(canonical_metrics) - ignored_metrics != set(audit_metrics) - ignored_metrics:
        mismatches.append("metric_keyset")
    for metric_id in sorted((set(canonical_metrics) & set(audit_metrics)) - ignored_metrics):
        for key in (
            "numerator", "denominator", "population_id", "applicability", "value",
            "threshold", "operation", "formula_version",
        ):
            if canonical_metrics[metric_id].get(key) != audit_metrics[metric_id].get(key):
                mismatches.append(f"metric.{metric_id}.{key}")
    canonical_gates = canonical.get("gates", {})
    audit_gates = audit.get("gates", {})
    if set(canonical_gates) != set(audit_gates):
        mismatches.append("gate_keyset")
    for gate_id in sorted(set(canonical_gates) & set(audit_gates)):
        for key in ("outcome", "pass"):
            if canonical_gates[gate_id].get(key) != audit_gates[gate_id].get(key):
                mismatches.append(f"gate.{gate_id}.{key}")
    return {"ok": not mismatches, "mismatches": mismatches}


def compare_case_observations(
    canonical: list[dict[str, Any]], audit: list[dict[str, Any]]
) -> dict[str, Any]:
    canonical_by_id = {row["case_id"]: row for row in canonical}
    audit_by_id = {row["case_id"]: row for row in audit}
    mismatches: list[str] = []
    if len(canonical_by_id) != len(canonical) or len(audit_by_id) != len(audit):
        mismatches.append("duplicate_case_id")
    if set(canonical_by_id) != set(audit_by_id):
        mismatches.append("case_id_bijection")
    fields = (
        "target_contract_valid", "runtime_contract_valid", "span_found", "identity_top1",
        "identity_retained", "exact_raw_identity", "exactly_one_identity",
        "finalizer_idempotence", "serialization_roundtrip", "path_finalized",
        "anchor_valid", "false_devanagari_top1", "devanagari_at_5",
        "raw_text_unchanged", "caps_ok", "candidate_count",
    )
    for case_id in sorted(set(canonical_by_id) & set(audit_by_id)):
        for field in fields:
            if canonical_by_id[case_id].get(field) != audit_by_id[case_id].get(field):
                mismatches.append(f"{case_id}.{field}")
    return {"ok": not mismatches, "mismatches": mismatches}


__all__ = [
    "compare_canonical_audit", "compare_case_observations", "observe_case_audit",
    "score_observations_audit",
]
