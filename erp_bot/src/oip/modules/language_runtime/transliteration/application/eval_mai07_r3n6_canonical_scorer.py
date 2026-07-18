"""R3N6 canonical scorer with complete scoring-chain metadata."""

from __future__ import annotations

import json
from typing import Any

from .eval_mai07_r3n4_canonical_scorer import (
    score_observations as _score_observations_r3n4,
)
from .r3n4_candidate_finalization import (
    canonical_serialize_candidates,
    finalize_idempotent,
)
from .r3n4_identity_anchor import IdentityAnchorError, create_identity_anchor
from .r3n5_target_span_contract import (
    TargetSpanContractError,
    select_bundle_span_by_target,
    target_span_from_case,
)
from .r3n6_scoring_contracts import (
    ALLOWED_EXPECTED_BEHAVIORS,
    bind_r3n6_report_identity,
    require_case_observation_bijection,
    require_exact_threshold_gate_spec,
    require_report_structure,
)


RUNTIME_VERSION = "mai-07.1.11-r3n6-chaincomplete"
SCORER_ID = "mai07_r3n6_canonical_scorer"


def _has_dev(surface: str) -> bool:
    return any(0x0900 <= ord(ch) <= 0x097F for ch in surface)


def _serialization_roundtrip_ok(candidates: list[Any]) -> bool:
    if not candidates:
        return False
    try:
        encoded = canonical_serialize_candidates(candidates)
        decoded = json.loads(encoded)
    except (TypeError, ValueError):
        return False
    expected = [
        {
            "candidate_id": candidate.candidate_id,
            "surface": candidate.surface,
            "kind": candidate.kind.value,
            "is_identity": bool(candidate.is_identity),
            "rank": int(candidate.rank),
            "ranking_score": f"{float(candidate.ranking_score):.6f}",
            "provenance": sorted(set(candidate.provenance or ())),
            "reason_codes": list(dict.fromkeys(candidate.reason_codes or ())),
            "requires_review": bool(candidate.requires_review),
            "alignment": candidate.alignment.model_dump(mode="json"),
            "script": candidate.script.value,
        }
        for candidate in candidates
    ]
    return bool(
        decoded == expected
        and canonical_serialize_candidates(candidates) == encoded
    )


def _passes_expected(observation: dict[str, Any]) -> bool:
    """Canonical expected-behavior formula, local to this scorer."""

    expected = observation.get("expected_behavior")
    if expected not in ALLOWED_EXPECTED_BEHAVIORS:
        return False
    if expected in (
        "IDENTITY_TOP1",
        "ACRONYM_IDENTITY_TOP1",
        "PROTECTED_IDENTITY",
    ):
        return bool(
            observation.get("span_found")
            and observation.get("identity_top1")
            and not observation.get("false_devanagari_top1")
        )
    if expected == "IDENTITY_RETAINED":
        return bool(
            observation.get("span_found")
            and observation.get("exact_raw_identity")
        )
    if expected == "ROMANIZED_SCRIPT_AT_5":
        return bool(
            observation.get("span_found") and observation.get("devanagari_at_5")
        )
    if expected == "SHARED_CONSERVATIVE":
        return bool(
            observation.get("span_found")
            and observation.get("exact_raw_identity")
        )
    if expected in ("NO_RAW_MUTATION", "CAP_OK"):
        return bool(
            observation.get("raw_text_unchanged")
            and observation.get("caps_ok")
            and observation.get("exact_raw_identity")
        )
    # Every allow-listed behavior is handled above.  No identity fallback is
    # permitted for a future or misspelled declaration.
    return False


def _split_expected_metric(
    cases: list[dict[str, Any]],
    observations: list[dict[str, Any]],
    *,
    split: str,
) -> dict[str, Any]:
    by_id = {
        observation.get("case_id"): observation
        for observation in observations
        if isinstance(observation, dict) and isinstance(observation.get("case_id"), str)
    }
    case_ids = [case.get("case_id") for case in cases]
    numerator = sum(
        1
        for case_id in case_ids
        if isinstance(case_id, str) and _passes_expected(by_id.get(case_id, {}))
    )
    denominator = len(case_ids)
    return {
        "metric_id": "split_expected_pass",
        "population_id": f"SPLIT_{split}",
        "numerator": numerator,
        "denominator": denominator,
        "applicability": (
            "APPLICABLE" if denominator else "INVALID_REQUIRED_POPULATION"
        ),
        "value": (numerator / denominator) if denominator else None,
        "threshold": 1.0,
        "operation": "==",
        "integer_required": False,
        "notes": "",
    }


def score_observations(
    cases: list[dict[str, Any]],
    observations: list[dict[str, Any]],
    *,
    thresholds: dict[str, Any],
    split: str = "DEVELOPMENT",
) -> dict[str, Any]:
    require_exact_threshold_gate_spec(thresholds)
    require_case_observation_bijection(
        cases, observations, side="canonical"
    )
    report = _score_observations_r3n4(
        cases, observations, thresholds=thresholds, split=split
    )
    report["metrics"] = dict(report.get("metrics", {}))
    report["metrics"]["split_expected_pass"] = _split_expected_metric(
        cases, observations, split=split
    )
    report["split"] = split
    report["observations"] = observations
    bound = bind_r3n6_report_identity(report, scorer_id=SCORER_ID)
    require_report_structure(
        bound,
        side="canonical",
        expected_case_ids=[case["case_id"] for case in cases],
    )
    return bound


def observe_case(
    case: dict[str, Any], bundle: Any, *, parent_bundle: Any | None = None
) -> dict[str, Any]:
    try:
        target = target_span_from_case(case)
    except TargetSpanContractError:
        target = None

    runtime_valid = getattr(bundle, "runtime_version", None) == RUNTIME_VERSION
    span_results = tuple(getattr(bundle, "span_results", ()) or ())
    span = (
        select_bundle_span_by_target(bundle, target)
        if target is not None and runtime_valid
        else None
    )
    candidates = list(span.candidates) if span is not None else []
    top = candidates[0] if candidates else None
    identities = [candidate for candidate in candidates if candidate.is_identity]
    exact_raw = bool(
        target is not None
        and any(
            candidate.surface == target.raw_surface for candidate in identities
        )
    )
    reason_codes = (
        set(getattr(span, "decision_reason_codes", ()) or ())
        if span is not None
        else set()
    )
    path_finalized = bool(
        span is not None
        and (
            "R3N4_ANCHOR_FINALIZED" in reason_codes
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
                raw_start=target.raw_start,
                raw_end_exclusive=target.raw_end_exclusive,
                anchor_kind="R3N6_CANONICAL_TARGET",
                created_from="eval_mai07_r3n6_canonical_scorer.observe_case",
            )
            anchor_valid = bool(
                exact_raw and anchor.raw_surface == target.raw_surface
            )
            finalizer_idempotent = finalize_idempotent(
                anchor, candidates, raw_text=case["input_text"]
            )
        except IdentityAnchorError:
            pass

    parent_identity_top1 = None
    if parent_bundle is not None and target is not None:
        parent_span = select_bundle_span_by_target(parent_bundle, target)
        parent_candidates = (
            list(parent_span.candidates) if parent_span is not None else []
        )
        parent_identity_top1 = bool(
            parent_candidates and parent_candidates[0].is_identity
        )

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
        "serialization_roundtrip": _serialization_roundtrip_ok(candidates),
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
        "parent_identity_top1": parent_identity_top1,
        "target_contract_valid": target is not None,
        "runtime_contract_valid": runtime_valid,
    }


__all__ = ["observe_case", "score_observations"]
