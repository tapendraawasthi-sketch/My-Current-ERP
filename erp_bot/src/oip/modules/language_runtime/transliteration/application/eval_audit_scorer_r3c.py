"""Independent MAI-07R3C audit scorer — must NOT import eval_scoring_r3c helpers."""

from __future__ import annotations

from fractions import Fraction
from typing import Any, Iterable, Sequence

_DEV_LO = 0x0900
_DEV_HI = 0x097F


def _has_dev(text: str) -> bool:
    return any(_DEV_LO <= ord(ch) <= _DEV_HI for ch in text)


def _hit(surface: str, *, is_identity: bool, kind: str, source: str, targets: set[str]) -> bool:
    if is_identity or kind in {"IDENTITY", "ABSTENTION"}:
        return False
    if surface == source:
        return False
    if not _has_dev(surface):
        return False
    return surface in targets


def audit_score_case_r3c(
    *,
    ranked: Sequence[dict[str, Any]],
    acceptable_targets: Iterable[str],
    source_surface: str,
    k: int = 5,
) -> dict[str, Any]:
    targets = set(acceptable_targets)
    rows = list(ranked)[:k]
    first = None
    for i, row in enumerate(rows, start=1):
        if _hit(
            row["surface"],
            is_identity=bool(row.get("is_identity")),
            kind=str(row.get("kind") or ""),
            source=source_surface,
            targets=targets,
        ):
            first = i
            break
    rr = Fraction(0, 1) if first is None else Fraction(1, first)
    return {
        "first_target_rank": first,
        "reciprocal_rank": rr,
        "top1": first == 1,
        "recall_at_1": first == 1,
        "recall_at_5": first is not None and first <= 5,
        "no_hit": first is None,
        "identity_at_rank_1": bool(rows and rows[0].get("is_identity")),
    }


def audit_aggregate_r3c(rows: Sequence[dict[str, Any]], *, k: int = 5) -> dict[str, Any]:
    n = top1 = r1 = r5 = no_hit = 0
    mrr = Fraction(0)
    hist: dict[str, int] = {}
    case_ids: list[str] = []
    for row in rows:
        case_ids.append(row["case_id"])
        scored = audit_score_case_r3c(
            ranked=row["ranked"],
            acceptable_targets=row["acceptable_targets"],
            source_surface=row["source_surface"],
            k=k,
        )
        n += 1
        mrr += scored["reciprocal_rank"]
        if scored["top1"]:
            top1 += 1
        if scored["recall_at_1"]:
            r1 += 1
        if scored["recall_at_5"]:
            r5 += 1
        if scored["no_hit"]:
            no_hit += 1
        key = "none" if scored["first_target_rank"] is None else str(scored["first_target_rank"])
        hist[key] = hist.get(key, 0) + 1
    mrr_v = mrr / n if n else Fraction(0)
    return {
        "denominator": n,
        "case_ids": case_ids,
        "TARGET_TOP1_ACCEPTABLE": {"numerator": top1, "denominator": n},
        "TARGET_RECALL_AT_1": {"numerator": r1, "denominator": n},
        "TARGET_RECALL_AT_5": {"numerator": r5, "denominator": n},
        "TARGET_MRR": {
            "numerator_sum": f"{mrr.numerator}/{mrr.denominator}",
            "denominator": n,
            "value_unrounded": str(mrr_v),
            "value_float": float(mrr_v),
        },
        "no_hit_count": no_hit,
        "hit_rank_histogram": dict(sorted(hist.items())),
    }


def assert_canonical_matches_audit(
    canonical: dict[str, Any], audit: dict[str, Any]
) -> None:
    for key in (
        "TARGET_TOP1_ACCEPTABLE",
        "TARGET_RECALL_AT_1",
        "TARGET_RECALL_AT_5",
    ):
        c = canonical[key]
        a = audit[key]
        if (c["numerator"], c["denominator"]) != (a["numerator"], a["denominator"]):
            raise AssertionError(f"audit mismatch {key}: {c} vs {a}")
    if canonical["TARGET_MRR"]["value_unrounded"] != audit["TARGET_MRR"]["value_unrounded"]:
        raise AssertionError("audit MRR mismatch")
    if set(canonical.get("case_ids") or []) != set(audit.get("case_ids") or []):
        raise AssertionError("audit case_id set mismatch")
