"""Canonical MAI-07C candidate-ranking metric scorer (Fraction-exact until display)."""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
from typing import Any, Iterable, Sequence


@dataclass(frozen=True)
class RankedCaseScore:
    case_id: str
    ranked_surfaces: tuple[str, ...]
    acceptable_surfaces: frozenset[str]
    first_acceptable_rank: int | None  # 1-based; None = no-hit
    reciprocal_rank_num: int
    reciprocal_rank_den: int
    top1_hit: bool
    recall_at_1: bool
    recall_at_3: bool
    recall_at_5: bool
    preferred_candidate: str | None = None
    preferred_top1_hit: bool | None = None
    truncation_visible: bool = False
    structural_error: str | None = None


@dataclass
class PopulationMetricBlock:
    population_id: str
    denominator: int = 0
    top1_numerator: int = 0
    recall1_numerator: int = 0
    recall3_numerator: int = 0
    recall5_numerator: int = 0
    mrr_sum: Fraction = field(default_factory=lambda: Fraction(0))
    no_hit_count: int = 0
    hit_rank_histogram: dict[str, int] = field(default_factory=dict)
    case_ids: list[str] = field(default_factory=list)

    def add(self, score: RankedCaseScore) -> None:
        self.denominator += 1
        self.case_ids.append(score.case_id)
        if score.first_acceptable_rank is None:
            self.no_hit_count += 1
            self.hit_rank_histogram["none"] = self.hit_rank_histogram.get("none", 0) + 1
        else:
            key = str(score.first_acceptable_rank)
            self.hit_rank_histogram[key] = self.hit_rank_histogram.get(key, 0) + 1
        self.mrr_sum += Fraction(score.reciprocal_rank_num, score.reciprocal_rank_den)
        if score.top1_hit:
            self.top1_numerator += 1
        if score.recall_at_1:
            self.recall1_numerator += 1
        if score.recall_at_3:
            self.recall3_numerator += 1
        if score.recall_at_5:
            self.recall5_numerator += 1

    def as_dict(self) -> dict[str, Any]:
        n = self.denominator
        mrr = self.mrr_sum / n if n else Fraction(0)
        return {
            "population_id": self.population_id,
            "denominator": n,
            "top1_acceptable_accuracy": {
                "numerator": self.top1_numerator,
                "denominator": n,
                "value_unrounded": str(Fraction(self.top1_numerator, n) if n else 0),
                "value_float": float(Fraction(self.top1_numerator, n) if n else 0),
            },
            "recall_at_1": {
                "numerator": self.recall1_numerator,
                "denominator": n,
                "value_unrounded": str(Fraction(self.recall1_numerator, n) if n else 0),
                "value_float": float(Fraction(self.recall1_numerator, n) if n else 0),
            },
            "recall_at_3": {
                "numerator": self.recall3_numerator,
                "denominator": n,
                "value_unrounded": str(Fraction(self.recall3_numerator, n) if n else 0),
                "value_float": float(Fraction(self.recall3_numerator, n) if n else 0),
            },
            "recall_at_5": {
                "numerator": self.recall5_numerator,
                "denominator": n,
                "value_unrounded": str(Fraction(self.recall5_numerator, n) if n else 0),
                "value_float": float(Fraction(self.recall5_numerator, n) if n else 0),
            },
            "mrr": {
                "numerator_sum": f"{self.mrr_sum.numerator}/{self.mrr_sum.denominator}",
                "denominator": n,
                "value_unrounded": str(mrr),
                "value_float": float(mrr),
            },
            "no_hit_count": self.no_hit_count,
            "hit_rank_histogram": dict(sorted(self.hit_rank_histogram.items())),
        }


def first_acceptable_rank(
    ranked_surfaces: Sequence[str],
    acceptable_surfaces: Iterable[str],
) -> int | None:
    """Minimum 1-based rank whose surface is acceptable; None if no-hit."""
    acc = frozenset(acceptable_surfaces)
    for i, surface in enumerate(ranked_surfaces, start=1):
        if surface in acc:
            return i
    return None


def score_ranked_case(
    *,
    case_id: str,
    ranked_surfaces: Sequence[str],
    acceptable_surfaces: Iterable[str],
    preferred_candidate: str | None = None,
    k: int = 5,
    structural_error: str | None = None,
) -> RankedCaseScore:
    """
    Canonical formulas for one case in a ranking population.

    - top1 / recall@k / RR use the acceptable set (not preferred, unless identical).
    - No-hit => RR = 0 / 1 (numerator 0, denominator 1) and remains in population N.
    - Multiple acceptable => earliest rank.
    - Does not renumber after filtering; ranking list is as produced (cap k for recall@5).
    """
    if not list(acceptable_surfaces):
        raise ValueError(f"empty_acceptable_set:{case_id}")

    produced = tuple(ranked_surfaces)
    # Detect duplicates without renumbering
    if len(produced) != len(set(produced)):
        structural_error = structural_error or "duplicate_candidates_in_ranked_list"

    capped = produced[:k]
    truncation_visible = len(produced) > k or (len(capped) < k and len(produced) == len(capped))
    # truncation_visible true when list shorter than k with no hit — callers may set; default: short list
    if len(capped) < k:
        truncation_visible = True

    acc = frozenset(acceptable_surfaces)
    rank = first_acceptable_rank(capped, acc)
    if rank is None:
        rr_num, rr_den = 0, 1
        top1 = recall1 = recall3 = recall5 = False
    else:
        rr_num, rr_den = 1, rank
        top1 = rank == 1
        recall1 = rank <= 1
        recall3 = rank <= 3
        recall5 = rank <= 5

    pref_hit: bool | None = None
    if preferred_candidate is not None:
        pref_hit = bool(capped) and capped[0] == preferred_candidate

    return RankedCaseScore(
        case_id=case_id,
        ranked_surfaces=capped,
        acceptable_surfaces=acc,
        first_acceptable_rank=rank,
        reciprocal_rank_num=rr_num,
        reciprocal_rank_den=rr_den,
        top1_hit=top1,
        recall_at_1=recall1,
        recall_at_3=recall3,
        recall_at_5=recall5,
        preferred_candidate=preferred_candidate,
        preferred_top1_hit=pref_hit,
        truncation_visible=truncation_visible,
        structural_error=structural_error,
    )


def aggregate_population(
    population_id: str,
    scores: Iterable[RankedCaseScore],
) -> PopulationMetricBlock:
    block = PopulationMetricBlock(population_id=population_id)
    seen: set[str] = set()
    for s in scores:
        if s.case_id in seen:
            raise ValueError(f"duplicate_case_in_population:{population_id}:{s.case_id}")
        seen.add(s.case_id)
        if s.structural_error == "duplicate_candidates_in_ranked_list":
            # structural: case must not silently reweight — raise for ranking pop
            raise ValueError(f"structural_duplicate_candidates:{s.case_id}")
        block.add(s)
    return block


def fraction_display(value: Fraction, *, places: int = 12) -> str:
    """Display-only rounding; never used inside aggregation."""
    return f"{float(value):.{places}f}"


@dataclass(frozen=True)
class ProducedCandidateView:
    """Eval-only view of a produced candidate (no runtime mutation)."""

    surface: str
    is_identity: bool
    kind: str
    script: str
    candidate_id: str = ""
    rank: int = 0


@dataclass(frozen=True)
class TargetCaseScore:
    case_id: str
    acceptable_target_candidates: frozenset[str]
    first_target_rank: int | None
    reciprocal_rank_num: int
    reciprocal_rank_den: int
    top1_hit: bool
    recall_at_1: bool
    recall_at_3: bool
    recall_at_5: bool
    identity_at_rank_1: bool
    correct_target_behind_identity: bool
    preferred_target_top1_hit: bool | None = None
    structural_error: str | None = None


@dataclass
class TargetPopulationBlock:
    population_id: str
    denominator: int = 0
    top1_numerator: int = 0
    recall1_numerator: int = 0
    recall3_numerator: int = 0
    recall5_numerator: int = 0
    mrr_sum: Fraction = field(default_factory=lambda: Fraction(0))
    no_target_count: int = 0
    identity_at_rank1_count: int = 0
    correct_target_behind_identity_count: int = 0
    hit_rank_histogram: dict[str, int] = field(default_factory=dict)
    case_ids: list[str] = field(default_factory=list)

    def add(self, score: TargetCaseScore) -> None:
        self.denominator += 1
        self.case_ids.append(score.case_id)
        if score.first_target_rank is None:
            self.no_target_count += 1
            self.hit_rank_histogram["none"] = self.hit_rank_histogram.get("none", 0) + 1
        else:
            key = str(score.first_target_rank)
            self.hit_rank_histogram[key] = self.hit_rank_histogram.get(key, 0) + 1
        self.mrr_sum += Fraction(score.reciprocal_rank_num, score.reciprocal_rank_den)
        if score.top1_hit:
            self.top1_numerator += 1
        if score.recall_at_1:
            self.recall1_numerator += 1
        if score.recall_at_3:
            self.recall3_numerator += 1
        if score.recall_at_5:
            self.recall5_numerator += 1
        if score.identity_at_rank_1:
            self.identity_at_rank1_count += 1
        if score.correct_target_behind_identity:
            self.correct_target_behind_identity_count += 1

    def as_dict(self) -> dict[str, Any]:
        n = self.denominator
        mrr = self.mrr_sum / n if n else Fraction(0)
        return {
            "population_id": self.population_id,
            "denominator": n,
            "target_candidate_top1_accuracy": {
                "numerator": self.top1_numerator,
                "denominator": n,
                "value_unrounded": str(Fraction(self.top1_numerator, n) if n else 0),
                "value_float": float(Fraction(self.top1_numerator, n) if n else 0),
            },
            "target_recall_at_1": {
                "numerator": self.recall1_numerator,
                "denominator": n,
                "value_unrounded": str(Fraction(self.recall1_numerator, n) if n else 0),
                "value_float": float(Fraction(self.recall1_numerator, n) if n else 0),
            },
            "target_recall_at_3": {
                "numerator": self.recall3_numerator,
                "denominator": n,
                "value_unrounded": str(Fraction(self.recall3_numerator, n) if n else 0),
                "value_float": float(Fraction(self.recall3_numerator, n) if n else 0),
            },
            "target_recall_at_5": {
                "numerator": self.recall5_numerator,
                "denominator": n,
                "value_unrounded": str(Fraction(self.recall5_numerator, n) if n else 0),
                "value_float": float(Fraction(self.recall5_numerator, n) if n else 0),
            },
            "target_mrr": {
                "numerator_sum": f"{self.mrr_sum.numerator}/{self.mrr_sum.denominator}",
                "denominator": n,
                "value_unrounded": str(mrr),
                "value_float": float(mrr),
            },
            "no_target_count": self.no_target_count,
            "identity_at_rank1_count": self.identity_at_rank1_count,
            "correct_target_behind_identity_count": self.correct_target_behind_identity_count,
            "hit_rank_histogram": dict(sorted(self.hit_rank_histogram.items())),
        }


def score_target_case(
    *,
    case_id: str,
    produced: Sequence[ProducedCandidateView],
    acceptable_target_candidates: Iterable[str],
    source_surface: str,
    preferred_target: str | None = None,
    k: int = 5,
    structural_error: str | None = None,
) -> TargetCaseScore:
    """
    Target (non-identity Devanagari) ranking metrics for one case.

    Identity at rank 1 is a miss for top-1. Identity presence does not satisfy recall.
    """
    from .eval_candidate_types import produced_is_target_hit

    targets = frozenset(acceptable_target_candidates)
    if not targets:
        raise ValueError(f"empty_acceptable_targets:{case_id}")

    capped = list(produced)[:k]
    surfaces = [c.surface for c in capped]
    if len(surfaces) != len(set(surfaces)):
        structural_error = structural_error or "duplicate_candidates_in_ranked_list"

    first_rank: int | None = None
    for cand in capped:
        if produced_is_target_hit(
            surface=cand.surface,
            is_identity=cand.is_identity,
            kind=cand.kind,
            script=cand.script,
            source_surface=source_surface,
            acceptable_targets=targets,
        ):
            first_rank = cand.rank if cand.rank >= 1 else (surfaces.index(cand.surface) + 1)
            # Prefer positional rank among capped list for RR
            first_rank = surfaces.index(cand.surface) + 1
            break

    if first_rank is None:
        rr_num, rr_den = 0, 1
        top1 = recall1 = recall3 = recall5 = False
    else:
        rr_num, rr_den = 1, first_rank
        top1 = first_rank == 1
        recall1 = first_rank <= 1
        recall3 = first_rank <= 3
        recall5 = first_rank <= 5

    identity_at_1 = bool(capped) and bool(capped[0].is_identity)
    behind = False
    if identity_at_1 and first_rank is not None and first_rank >= 2:
        behind = True

    pref_hit: bool | None = None
    if preferred_target is not None:
        pref_hit = (
            bool(capped)
            and (not capped[0].is_identity)
            and capped[0].surface == preferred_target
            and preferred_target in targets
        )

    return TargetCaseScore(
        case_id=case_id,
        acceptable_target_candidates=targets,
        first_target_rank=first_rank,
        reciprocal_rank_num=rr_num,
        reciprocal_rank_den=rr_den,
        top1_hit=top1,
        recall_at_1=recall1,
        recall_at_3=recall3,
        recall_at_5=recall5,
        identity_at_rank_1=identity_at_1,
        correct_target_behind_identity=behind,
        preferred_target_top1_hit=pref_hit,
        structural_error=structural_error,
    )


def aggregate_target_population(
    population_id: str,
    scores: Iterable[TargetCaseScore],
) -> TargetPopulationBlock:
    block = TargetPopulationBlock(population_id=population_id)
    seen: set[str] = set()
    for s in scores:
        if s.case_id in seen:
            raise ValueError(f"duplicate_case_in_population:{population_id}:{s.case_id}")
        seen.add(s.case_id)
        if s.structural_error == "duplicate_candidates_in_ranked_list":
            raise ValueError(f"structural_duplicate_candidates:{s.case_id}")
        block.add(s)
    return block


__all__ = [
    "RankedCaseScore",
    "PopulationMetricBlock",
    "first_acceptable_rank",
    "score_ranked_case",
    "aggregate_population",
    "fraction_display",
    "ProducedCandidateView",
    "TargetCaseScore",
    "TargetPopulationBlock",
    "score_target_case",
    "aggregate_target_population",
]
