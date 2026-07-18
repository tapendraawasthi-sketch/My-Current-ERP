"""MAI-07C evaluation metric integrity tests (hand-calculated + property tests)."""

from __future__ import annotations

import random
from fractions import Fraction

import pytest

from src.oip.modules.language_runtime.transliteration.application.eval_audit_scorer import (
    audit_aggregate,
    audit_score_case,
)
from src.oip.modules.language_runtime.transliteration.application.eval_invariants import (
    MetricInvariantError,
    assert_canonical_equals_audit,
    validate_shared_ranking_invariants,
)
from src.oip.modules.language_runtime.transliteration.application.eval_populations import (
    classify_case_populations,
)
from src.oip.modules.language_runtime.transliteration.application.eval_scoring import (
    aggregate_population,
    score_ranked_case,
)


def test_rank1_acceptable():
    s = score_ranked_case(
        case_id="t1",
        ranked_surfaces=["मेरो", "mero"],
        acceptable_surfaces=["मेरो"],
    )
    assert s.top1_hit and s.recall_at_5
    assert s.reciprocal_rank_num == 1 and s.reciprocal_rank_den == 1


def test_rank2_acceptable():
    s = score_ranked_case(
        case_id="t2",
        ranked_surfaces=["a", "मेरो", "b"],
        acceptable_surfaces=["मेरो"],
    )
    assert not s.top1_hit
    assert s.recall_at_5
    assert Fraction(s.reciprocal_rank_num, s.reciprocal_rank_den) == Fraction(1, 2)


def test_rank3_acceptable():
    s = score_ranked_case(
        case_id="t3",
        ranked_surfaces=["a", "b", "मेरो", "c", "d"],
        acceptable_surfaces=["मेरो"],
    )
    assert Fraction(s.reciprocal_rank_num, s.reciprocal_rank_den) == Fraction(1, 3)


def test_rank5_acceptable():
    s = score_ranked_case(
        case_id="t5",
        ranked_surfaces=["a", "b", "c", "d", "मेरो"],
        acceptable_surfaces=["मेरो"],
    )
    assert Fraction(s.reciprocal_rank_num, s.reciprocal_rank_den) == Fraction(1, 5)


def test_no_hit_stays_in_denominator():
    s = score_ranked_case(
        case_id="nh",
        ranked_surfaces=["a", "b", "c", "d", "e"],
        acceptable_surfaces=["मेरो"],
    )
    assert not s.recall_at_5
    assert s.reciprocal_rank_num == 0
    block = aggregate_population("P", [s])
    assert block.denominator == 1
    assert block.no_hit_count == 1
    assert block.mrr_sum == Fraction(0)


def test_multiple_acceptable_earliest_rank():
    s = score_ranked_case(
        case_id="m",
        ranked_surfaces=["x", "A", "y", "B", "z"],
        acceptable_surfaces=["A", "B"],
    )
    assert Fraction(s.reciprocal_rank_num, s.reciprocal_rank_den) == Fraction(1, 2)


def test_identity_acceptable_at_rank1():
    s = score_ranked_case(
        case_id="id1",
        ranked_surfaces=["hello", "हेलो"],
        acceptable_surfaces=["hello"],
    )
    assert s.top1_hit
    assert s.reciprocal_rank_den == 1


def test_identity_present_but_not_acceptable():
    s = score_ranked_case(
        case_id="id0",
        ranked_surfaces=["hello", "मेरो"],
        acceptable_surfaces=["मेरो"],
    )
    assert not s.top1_hit
    assert Fraction(s.reciprocal_rank_num, s.reciprocal_rank_den) == Fraction(1, 2)


def test_abstention_excluded_only_via_population_rule():
    case = {
        "case_id": "amb_1",
        "suite_id": "ambiguous_latin_v1",
        "input_text": "xyzzy",
        "acceptable_candidates": ["xyzzy"],
        "preferred_candidate": "xyzzy",
        "abstention_expected": True,
        "context_challenge": False,
    }
    pop = classify_case_populations(case)
    assert "ABSTENTION_POPULATION" in pop["memberships"]
    assert "CANDIDATE_RANKING_POPULATION" not in pop["memberships"]
    assert "abstention_expected" in pop["reasons"]["exclude_CANDIDATE_RANKING_POPULATION"]


def test_empty_acceptable_rejected():
    with pytest.raises(ValueError, match="empty_acceptable"):
        score_ranked_case(
            case_id="e",
            ranked_surfaces=["a"],
            acceptable_surfaces=[],
        )


def test_duplicate_candidates_structural_failure():
    with pytest.raises(ValueError, match="duplicate"):
        aggregate_population(
            "P",
            [
                score_ranked_case(
                    case_id="dup",
                    ranked_surfaces=["a", "a", "b"],
                    acceptable_surfaces=["b"],
                )
            ],
        )


def test_truncated_no_hit_rr_zero():
    s = score_ranked_case(
        case_id="tr",
        ranked_surfaces=["a", "b"],  # shorter than k=5
        acceptable_surfaces=["z"],
    )
    assert s.reciprocal_rank_num == 0
    assert s.truncation_visible


def test_mixed_mini_dataset_mrr():
    scores = [
        score_ranked_case(case_id="a", ranked_surfaces=["X"], acceptable_surfaces=["X"]),
        score_ranked_case(case_id="b", ranked_surfaces=["z", "X"], acceptable_surfaces=["X"]),
        score_ranked_case(case_id="c", ranked_surfaces=["z", "y", "X"], acceptable_surfaces=["X"]),
        score_ranked_case(case_id="d", ranked_surfaces=["a", "b", "c", "d", "e"], acceptable_surfaces=["X"]),
    ]
    block = aggregate_population("P", scores)
    expected = (Fraction(1) + Fraction(1, 2) + Fraction(1, 3) + Fraction(0)) / 4
    assert block.mrr_sum / block.denominator == expected


def test_different_denominators_require_different_metric_names():
    # Documented contract: preferred vs acceptable must not share an unqualified name.
    pref = score_ranked_case(
        case_id="p",
        ranked_surfaces=["wrong", "मेरो"],
        acceptable_surfaces=["मेरो"],
        preferred_candidate="wrong_preferred_not_at_1",
    )
    assert pref.top1_hit is False  # acceptable top1
    assert pref.preferred_top1_hit is False
    # If preferred were at rank1 but not acceptable, preferred_top1 could differ:
    s2 = score_ranked_case(
        case_id="p2",
        ranked_surfaces=["pref", "मेरो"],
        acceptable_surfaces=["मेरो"],
        preferred_candidate="pref",
    )
    assert s2.preferred_top1_hit is True
    assert s2.top1_hit is False


def test_premature_rounding_cannot_forge_mrr_one():
    # Average of many near-1 floats can round to 1.0 incorrectly if rounded early.
    # Exact Fraction aggregation must not.
    scores = [
        score_ranked_case(case_id=f"r{i}", ranked_surfaces=["z", "X"], acceptable_surfaces=["X"])
        for i in range(100)
    ]
    # all RR=1/2
    block = aggregate_population("P", scores)
    mrr = block.mrr_sum / block.denominator
    assert mrr == Fraction(1, 2)
    assert float(mrr) != 1.0


def test_independent_audit_agrees():
    rows = [
        {"case_id": "a", "ranked_surfaces": ["X"], "acceptable_surfaces": ["X"]},
        {"case_id": "b", "ranked_surfaces": ["z", "X"], "acceptable_surfaces": ["X"]},
        {"case_id": "c", "ranked_surfaces": ["a", "b", "c"], "acceptable_surfaces": ["X"]},
    ]
    scores = [
        score_ranked_case(
            case_id=r["case_id"],
            ranked_surfaces=r["ranked_surfaces"],
            acceptable_surfaces=r["acceptable_surfaces"],
        )
        for r in rows
    ]
    block = aggregate_population("P", scores)
    audit = audit_aggregate(rows)
    assert_canonical_equals_audit(
        canonical={
            "top1_numerator": block.top1_numerator,
            "recall_at_1_numerator": block.recall1_numerator,
            "recall_at_3_numerator": block.recall3_numerator,
            "recall_at_5_numerator": block.recall5_numerator,
            "denominator": block.denominator,
            "no_hit_count": block.no_hit_count,
            "mrr_sum": block.mrr_sum,
        },
        audit=audit,
    )


def test_invariant_fail_fast_on_impossible_mrr():
    with pytest.raises(MetricInvariantError):
        # top1=1, recall5=1, but mrr_sum implies MRR > 1 (impossible) — use top1=0, recall=1, mrr=1
        validate_shared_ranking_invariants(
            top1_num=0,
            recall1_num=0,
            recall3_num=1,
            recall5_num=1,
            mrr_sum=Fraction(1),  # MRR=1 with top1=0 violates top1<=MRR is OK; but mrr<=recall5 ok
            # Actually top1=0, mrr=1, recall5=1 is invalid for K=5 upper: 0+(1-0)/2=0.5
            denominator=1,
        )


def test_property_invariants_1000_seeded():
    rng = random.Random(20260714)
    for i in range(1000):
        n = rng.randint(1, 12)
        scores = []
        audit_rows = []
        for j in range(n):
            hit_mode = rng.choice([1, 2, 3, 4, 5, None, None])
            surfaces = [f"c{j}_{r}" for r in range(1, 6)]
            if hit_mode is None:
                acceptable = [f"miss_{j}"]
            else:
                # possibly multiple acceptable
                acceptable = [surfaces[hit_mode - 1]]
                if rng.random() < 0.3 and hit_mode < 5:
                    acceptable.append(surfaces[rng.randint(hit_mode, 4)])
            s = score_ranked_case(
                case_id=f"g{i}_{j}",
                ranked_surfaces=surfaces,
                acceptable_surfaces=acceptable,
            )
            scores.append(s)
            audit_rows.append(
                {
                    "case_id": s.case_id,
                    "ranked_surfaces": list(s.ranked_surfaces),
                    "acceptable_surfaces": acceptable,
                }
            )
        block = aggregate_population(f"G{i}", scores)
        validate_shared_ranking_invariants(
            top1_num=block.top1_numerator,
            recall1_num=block.recall1_numerator,
            recall3_num=block.recall3_numerator,
            recall5_num=block.recall5_numerator,
            mrr_sum=block.mrr_sum,
            denominator=block.denominator,
        )
        audit = audit_aggregate(audit_rows)
        assert_canonical_equals_audit(
            canonical={
                "top1_numerator": block.top1_numerator,
                "recall_at_1_numerator": block.recall1_numerator,
                "recall_at_3_numerator": block.recall3_numerator,
                "recall_at_5_numerator": block.recall5_numerator,
                "denominator": block.denominator,
                "no_hit_count": block.no_hit_count,
                "mrr_sum": block.mrr_sum,
            },
            audit=audit,
        )

        # Monotonic / ordering properties on a mutated copy
        mrr = block.mrr_sum / block.denominator
        # adding a no-hit cannot increase MRR
        worse = scores + [
            score_ranked_case(
                case_id=f"g{i}_extra",
                ranked_surfaces=["a", "b", "c", "d", "e"],
                acceptable_surfaces=["NO"],
            )
        ]
        b2 = aggregate_population(f"G{i}w", worse)
        assert b2.mrr_sum / b2.denominator <= mrr

        # moving first hit to worse rank cannot increase that case's RR
        base = scores[0]
        if base.first_acceptable_rank is not None and base.first_acceptable_rank < 5:
            ranked = list(base.ranked_surfaces)
            # put first acceptable at the end
            acc = next(x for x in ranked if x in base.acceptable_surfaces)
            ranked = [x for x in ranked if x != acc] + [acc]
            moved = score_ranked_case(
                case_id=base.case_id + "_moved",
                ranked_surfaces=ranked,
                acceptable_surfaces=list(base.acceptable_surfaces),
            )
            assert Fraction(moved.reciprocal_rank_num, moved.reciprocal_rank_den) <= Fraction(
                base.reciprocal_rank_num, base.reciprocal_rank_den
            )

        # duplicate case detection
        with pytest.raises(ValueError, match="duplicate_case"):
            aggregate_population("dup", [scores[0], scores[0]])


def test_audit_score_case_plain():
    r = audit_score_case(ranked_surfaces=["a", "b", "c"], acceptable_surfaces=["c"])
    assert r["reciprocal_rank"] == Fraction(1, 3)
    assert r["top1"] is False
