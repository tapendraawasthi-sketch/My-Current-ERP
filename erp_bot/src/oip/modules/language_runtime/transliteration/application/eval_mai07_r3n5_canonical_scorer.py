"""R3N5 canonical observations bound to immutable target-span offsets."""

from __future__ import annotations

import json
from typing import Any

from .eval_mai07_r3n4_canonical_scorer import score_observations as _score_observations_r3n4
from .r3n4_candidate_finalization import canonical_serialize_candidates, finalize_idempotent
from .r3n4_identity_anchor import IdentityAnchorError, create_identity_anchor
from .r3n5_target_span_contract import (
    TargetSpanContractError,
    select_bundle_span_by_target,
    target_span_from_case,
)
from .r3n5_scoring_contracts import bind_r3n5_report_identity


def _has_dev(surface: str) -> bool:
    return any(0x0900 <= ord(ch) <= 0x097F for ch in surface)


def _serialization_roundtrip_ok(cands: list[Any]) -> bool:
    if not cands:
        return False
    try:
        encoded = canonical_serialize_candidates(cands)
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
        for candidate in cands
    ]
    stable = canonical_serialize_candidates(cands) == encoded
    return bool(
        decoded == expected
        and stable
    )


def score_observations(
    cases: list[dict[str, Any]], observations: list[dict[str, Any]], *, thresholds: dict[str, Any], split: str = "DEVELOPMENT"
) -> dict[str, Any]:
    report = _score_observations_r3n4(cases, observations, thresholds=thresholds, split=split)
    return bind_r3n5_report_identity(report, scorer_id="mai07_r3n5_canonical_scorer")


def observe_case(case: dict[str, Any], bundle: Any, *, parent_bundle: Any | None = None) -> dict[str, Any]:
    try:
        target = target_span_from_case(case)
    except TargetSpanContractError:
        target = None
    runtime_valid = getattr(bundle, "runtime_version", None) == "mai-07.1.10-r3n5-targetspan"
    span = select_bundle_span_by_target(bundle, target) if target is not None and runtime_valid else None
    cands = list(span.candidates) if span is not None else []
    top = cands[0] if cands else None
    id_top1 = bool(top and top.is_identity)
    identity = [c for c in cands if c.is_identity]
    exact_raw = bool(
        target is not None and any(candidate.surface == target.raw_surface for candidate in identity)
    )
    dev_top1 = bool(top and not top.is_identity and _has_dev(top.surface))
    dev_at5 = any(not c.is_identity and _has_dev(c.surface) for c in cands[:5])
    caps_ok = all(len(s.candidates) <= 5 for s in bundle.span_results)
    reason_codes = set(getattr(span, "decision_reason_codes", ()) or ()) if span is not None else set()
    path_finalized = bool(
        span is not None
        and (
            "R3N4_ANCHOR_FINALIZED" in reason_codes
            or any("r3n4_anchor_reserved" in (c.provenance or ()) for c in cands)
        )
    )
    anchor_valid = False
    finalizer_idempotent = False
    if span is not None and target is not None and cands:
        try:
            anchor = create_identity_anchor(
                case["input_text"],
                raw_start=target.raw_start,
                raw_end_exclusive=target.raw_end_exclusive,
                anchor_kind="R3N5_AUDIT_TARGET",
                created_from="eval_mai07_r3n5_canonical_scorer.observe_case",
            )
            anchor_valid = anchor.raw_surface == target.raw_surface and exact_raw
            finalizer_idempotent = finalize_idempotent(
                anchor, cands, raw_text=case["input_text"]
            )
        except IdentityAnchorError:
            pass
    parent_identity_top1 = None
    if parent_bundle is not None and target is not None:
        parent_span = select_bundle_span_by_target(parent_bundle, target)
        parent_cands = list(parent_span.candidates) if parent_span is not None else []
        parent_identity_top1 = bool(parent_cands and parent_cands[0].is_identity)
    return {
        "case_id": case["case_id"],
        "populations": list(case.get("populations") or case.get("population_ids") or []),
        "expected_behavior": case.get("expected_behavior"),
        "span_found": span is not None,
        "identity_top1": id_top1,
        "identity_retained": bool(identity),
        "exact_raw_identity": exact_raw,
        "exactly_one_identity": len(identity) == 1,
        "finalizer_idempotence": finalizer_idempotent,
        "serialization_roundtrip": _serialization_roundtrip_ok(cands),
        "path_finalized": path_finalized,
        "anchor_valid": anchor_valid,
        "false_devanagari_top1": dev_top1,
        "devanagari_at_5": dev_at5,
        "raw_text_unchanged": target is not None,
        "caps_ok": caps_ok,
        "candidate_count": len(cands),
        "parent_identity_top1": parent_identity_top1,
        "target_contract_valid": target is not None,
        "runtime_contract_valid": runtime_valid,
    }


__all__ = ["observe_case", "score_observations"]
