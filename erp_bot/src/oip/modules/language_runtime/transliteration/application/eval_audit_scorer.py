"""Independent MAI-07C/C2 audit scorer — does not import production metric functions."""

from __future__ import annotations

from fractions import Fraction
from typing import Any, Iterable, Sequence

_DEV_LO = 0x0900
_DEV_HI = 0x097F


def _has_dev(text: str) -> bool:
    return any(_DEV_LO <= ord(ch) <= _DEV_HI for ch in text)


def _first_hit_rank(ranked: Sequence[str], acceptable: Iterable[str]) -> int | None:
    ok = set(acceptable)
    for idx, surface in enumerate(ranked):
        if surface in ok:
            return idx + 1
    return None


def audit_score_case(
    *,
    ranked_surfaces: Sequence[str],
    acceptable_surfaces: Sequence[str],
    k: int = 5,
) -> dict[str, Any]:
    """Plain recomputation suitable for manual inspection (C1 any-acceptable)."""
    if not acceptable_surfaces:
        raise ValueError("audit_empty_acceptable")
    ranked = list(ranked_surfaces)[:k]
    if len(ranked) != len(set(ranked)):
        raise ValueError("audit_duplicate_candidates")
    rank = _first_hit_rank(ranked, acceptable_surfaces)
    if rank is None:
        rr = Fraction(0, 1)
    else:
        rr = Fraction(1, rank)
    return {
        "first_acceptable_rank": rank,
        "reciprocal_rank": rr,
        "reciprocal_rank_num": rr.numerator,
        "reciprocal_rank_den": rr.denominator,
        "top1": rank == 1,
        "recall_at_1": rank is not None and rank <= 1,
        "recall_at_3": rank is not None and rank <= 3,
        "recall_at_5": rank is not None and rank <= 5,
        "no_hit": rank is None,
    }


def audit_aggregate(cases: Sequence[dict[str, Any]], *, k: int = 5) -> dict[str, Any]:
    n = 0
    top1 = recall1 = recall3 = recall5 = 0
    mrr_sum = Fraction(0)
    no_hit = 0
    hist: dict[str, int] = {}
    seen: set[str] = set()
    for row in cases:
        cid = row["case_id"]
        if cid in seen:
            raise ValueError(f"audit_duplicate_case:{cid}")
        seen.add(cid)
        scored = audit_score_case(
            ranked_surfaces=row["ranked_surfaces"],
            acceptable_surfaces=row["acceptable_surfaces"],
            k=k,
        )
        n += 1
        mrr_sum += scored["reciprocal_rank"]
        if scored["top1"]:
            top1 += 1
        if scored["recall_at_1"]:
            recall1 += 1
        if scored["recall_at_3"]:
            recall3 += 1
        if scored["recall_at_5"]:
            recall5 += 1
        if scored["no_hit"]:
            no_hit += 1
            hist["none"] = hist.get("none", 0) + 1
        else:
            key = str(scored["first_acceptable_rank"])
            hist[key] = hist.get(key, 0) + 1
    mrr = mrr_sum / n if n else Fraction(0)
    return {
        "denominator": n,
        "top1_numerator": top1,
        "recall_at_1_numerator": recall1,
        "recall_at_3_numerator": recall3,
        "recall_at_5_numerator": recall5,
        "mrr_sum": mrr_sum,
        "mrr": mrr,
        "no_hit_count": no_hit,
        "hit_rank_histogram": dict(sorted(hist.items())),
        "included_count": n,
        "excluded_count": 0,
    }


def audit_target_score_case(
    *,
    produced: Sequence[dict[str, Any]],
    acceptable_targets: Sequence[str],
    source_surface: str,
    k: int = 5,
) -> dict[str, Any]:
    """
    Independent target scoring.

    Each produced item: {surface, is_identity, kind, script}.
    Does not import eval_scoring / eval_candidate_types.
    """
    if not acceptable_targets:
        raise ValueError("audit_empty_targets")
    targets = set(acceptable_targets)
    rows = list(produced)[:k]
    surfaces = [r["surface"] for r in rows]
    if len(surfaces) != len(set(surfaces)):
        raise ValueError("audit_duplicate_candidates")

    first_rank: int | None = None
    for idx, row in enumerate(rows, start=1):
        surface = row["surface"]
        if row.get("is_identity"):
            continue
        kind = row.get("kind") or ""
        if kind in {"IDENTITY", "ABSTENTION"}:
            continue
        if surface == source_surface:
            continue
        if not _has_dev(surface):
            continue
        script = row.get("script") or ""
        if script == "LATIN":
            continue
        if surface in targets:
            first_rank = idx
            break

    if first_rank is None:
        rr = Fraction(0, 1)
    else:
        rr = Fraction(1, first_rank)
    identity_at_1 = bool(rows) and bool(rows[0].get("is_identity"))
    behind = bool(identity_at_1 and first_rank is not None and first_rank >= 2)
    return {
        "first_target_rank": first_rank,
        "reciprocal_rank": rr,
        "reciprocal_rank_num": rr.numerator,
        "reciprocal_rank_den": rr.denominator,
        "top1": first_rank == 1,
        "recall_at_1": first_rank is not None and first_rank <= 1,
        "recall_at_3": first_rank is not None and first_rank <= 3,
        "recall_at_5": first_rank is not None and first_rank <= 5,
        "no_target": first_rank is None,
        "identity_at_rank_1": identity_at_1,
        "correct_target_behind_identity": behind,
    }


def audit_target_aggregate(cases: Sequence[dict[str, Any]], *, k: int = 5) -> dict[str, Any]:
    """
    Cases: case_id, produced (list of dicts), acceptable_targets, source_surface.
    """
    n = 0
    top1 = recall1 = recall3 = recall5 = 0
    mrr_sum = Fraction(0)
    no_target = 0
    id_at1 = 0
    behind = 0
    no_label = 0
    hist: dict[str, int] = {}
    seen: set[str] = set()
    for row in cases:
        cid = row["case_id"]
        if cid in seen:
            raise ValueError(f"audit_duplicate_case:{cid}")
        seen.add(cid)
        targets = list(row.get("acceptable_targets") or [])
        if not targets:
            no_label += 1
            continue
        scored = audit_target_score_case(
            produced=row["produced"],
            acceptable_targets=targets,
            source_surface=row["source_surface"],
            k=k,
        )
        n += 1
        mrr_sum += scored["reciprocal_rank"]
        if scored["top1"]:
            top1 += 1
        if scored["recall_at_1"]:
            recall1 += 1
        if scored["recall_at_3"]:
            recall3 += 1
        if scored["recall_at_5"]:
            recall5 += 1
        if scored["no_target"]:
            no_target += 1
            hist["none"] = hist.get("none", 0) + 1
        else:
            key = str(scored["first_target_rank"])
            hist[key] = hist.get(key, 0) + 1
        if scored["identity_at_rank_1"]:
            id_at1 += 1
        if scored["correct_target_behind_identity"]:
            behind += 1
    mrr = mrr_sum / n if n else Fraction(0)
    return {
        "denominator": n,
        "top1_numerator": top1,
        "recall_at_1_numerator": recall1,
        "recall_at_3_numerator": recall3,
        "recall_at_5_numerator": recall5,
        "mrr_sum": mrr_sum,
        "mrr": mrr,
        "no_target_count": no_target,
        "identity_at_rank1_count": id_at1,
        "correct_target_behind_identity_count": behind,
        "cases_with_no_acceptable_target_label": no_label,
        "hit_rank_histogram": dict(sorted(hist.items())),
    }


__all__ = [
    "audit_score_case",
    "audit_aggregate",
    "audit_target_score_case",
    "audit_target_aggregate",
]
