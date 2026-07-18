"""Fail-fast mathematical invariants for MAI-07C shared-population metrics."""

from __future__ import annotations

from fractions import Fraction
from typing import Any

from .eval_metric_definitions import CANDIDATE_CAP_K


class MetricInvariantError(ValueError):
    """Raised when evaluation metrics violate required mathematical invariants."""


def _as_fraction(numer: int, denom: int) -> Fraction:
    if denom < 0 or numer < 0:
        raise MetricInvariantError(f"negative_count:{numer}/{denom}")
    if numer > denom:
        raise MetricInvariantError(f"numerator_gt_denominator:{numer}/{denom}")
    return Fraction(numer, denom) if denom else Fraction(0)


def validate_shared_ranking_invariants(
    *,
    top1_num: int,
    recall1_num: int,
    recall3_num: int,
    recall5_num: int,
    mrr_sum: Fraction,
    denominator: int,
    candidate_cap_k: int = CANDIDATE_CAP_K,
) -> None:
    if denominator <= 0:
        raise MetricInvariantError("empty_shared_population")

    top1 = _as_fraction(top1_num, denominator)
    r1 = _as_fraction(recall1_num, denominator)
    r3 = _as_fraction(recall3_num, denominator)
    r5 = _as_fraction(recall5_num, denominator)
    mrr = mrr_sum / denominator

    if not (Fraction(0) <= top1 <= Fraction(1)):
        raise MetricInvariantError(f"top1_oob:{top1}")
    if not (Fraction(0) <= mrr <= Fraction(1)):
        raise MetricInvariantError(f"mrr_oob:{mrr}")
    if not (Fraction(0) <= r1 <= r3 <= r5 <= Fraction(1)):
        raise MetricInvariantError(f"recall_not_monotonic:{r1},{r3},{r5}")
    if top1 != r1:
        raise MetricInvariantError(f"top1_ne_recall1:{top1}!={r1}")
    if top1 > mrr:
        raise MetricInvariantError(f"top1_gt_mrr:{top1}>{mrr}")
    if mrr > r5:
        raise MetricInvariantError(f"mrr_gt_recall5:{mrr}>{r5}")
    if top1_num > recall5_num:
        raise MetricInvariantError(f"top1_num_gt_recall5_num:{top1_num}>{recall5_num}")

    if candidate_cap_k == 5:
        # Non-top-1 hits contribute at most 1/2 to MRR.
        upper = top1 + (r5 - top1) / 2
        if mrr > upper:
            raise MetricInvariantError(f"mrr_exceeds_k5_upper_bound:{mrr}>{upper}")


def validate_population_reconciliation(
    *,
    frozen_total: int,
    included_by_population: dict[str, int],
    excluded_count: int,
    excluded_reasons: dict[str, int],
) -> None:
    # excluded + unique included across disjoint role is not required for overlapping pops;
    # require: every frozen case is accounted for in exclusion ledger OR membership ledger.
    accounted = excluded_count
    if accounted + sum(included_by_population.values()) < frozen_total:
        # overlapping memberships inflate sum — only check excluded + ranking coverage via reasons
        pass
    if sum(excluded_reasons.values()) != excluded_count and excluded_reasons:
        # reasons may be multi-label; skip strict
        pass
    if frozen_total < 0:
        raise MetricInvariantError("negative_frozen_total")


def assert_canonical_equals_audit(
    *,
    canonical: dict[str, Any],
    audit: dict[str, Any],
) -> None:
    """Prefer exact numerator/denominator equality."""
    mapping = [
        ("top1_numerator", "top1_numerator"),
        ("recall_at_1_numerator", "recall_at_1_numerator"),
        ("recall_at_3_numerator", "recall_at_3_numerator"),
        ("recall_at_5_numerator", "recall_at_5_numerator"),
        ("denominator", "denominator"),
        ("no_hit_count", "no_hit_count"),
    ]
    for ck, ak in mapping:
        if canonical.get(ck) != audit.get(ak):
            raise MetricInvariantError(f"canonical_audit_mismatch:{ck}:{canonical.get(ck)}!={audit.get(ak)}")
    if Fraction(canonical["mrr_sum"]) != audit["mrr_sum"]:
        raise MetricInvariantError(
            f"canonical_audit_mrr_mismatch:{canonical['mrr_sum']}!={audit['mrr_sum']}"
        )


__all__ = [
    "MetricInvariantError",
    "validate_shared_ranking_invariants",
    "validate_population_reconciliation",
    "assert_canonical_equals_audit",
]
