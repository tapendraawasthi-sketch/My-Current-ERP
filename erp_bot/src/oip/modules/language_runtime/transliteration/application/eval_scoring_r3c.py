"""MAI-07R3C canonical V2 target scorer (Fraction-exact; no ranker config)."""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
from typing import Any, Iterable, Sequence

from .eval_candidate_roles_r3c import is_target_hit
from .eval_scoring import ProducedCandidateView


@dataclass(frozen=True)
class R3CTargetScore:
    case_id: str
    first_target_rank: int | None
    reciprocal_rank: Fraction
    top1_hit: bool
    recall_at_1: bool
    recall_at_5: bool
    unique_preference_top1_hit: bool | None
    identity_at_rank_1: bool
    structural_error: str | None = None


@dataclass
class R3CPopulationBlock:
    population_id: str
    denominator: int = 0
    top1_num: int = 0
    recall1_num: int = 0
    recall5_num: int = 0
    unique_pref_top1_num: int = 0
    unique_pref_den: int = 0
    mrr_sum: Fraction = field(default_factory=lambda: Fraction(0))
    no_hit: int = 0
    multi_preferred_ambiguity: int = 0
    case_ids: list[str] = field(default_factory=list)
    hist: dict[str, int] = field(default_factory=dict)

    def add(self, score: R3CTargetScore, *, ambiguous_multi_preferred: bool = False) -> None:
        self.denominator += 1
        self.case_ids.append(score.case_id)
        if score.first_target_rank is None:
            self.no_hit += 1
            self.hist["none"] = self.hist.get("none", 0) + 1
        else:
            key = str(score.first_target_rank)
            self.hist[key] = self.hist.get(key, 0) + 1
        self.mrr_sum += score.reciprocal_rank
        if score.top1_hit:
            self.top1_num += 1
        if score.recall_at_1:
            self.recall1_num += 1
        if score.recall_at_5:
            self.recall5_num += 1
        if score.unique_preference_top1_hit is not None:
            self.unique_pref_den += 1
            if score.unique_preference_top1_hit:
                self.unique_pref_top1_num += 1
        if ambiguous_multi_preferred:
            self.multi_preferred_ambiguity += 1

    def as_dict(self) -> dict[str, Any]:
        n = self.denominator
        mrr = self.mrr_sum / n if n else Fraction(0)
        return {
            "population_id": self.population_id,
            "denominator": n,
            "TARGET_TOP1_ACCEPTABLE": _frac(self.top1_num, n),
            "TARGET_RECALL_AT_1": _frac(self.recall1_num, n),
            "TARGET_RECALL_AT_5": _frac(self.recall5_num, n),
            "TARGET_MRR": {
                "numerator_sum": f"{self.mrr_sum.numerator}/{self.mrr_sum.denominator}",
                "denominator": n,
                "value_unrounded": str(mrr),
                "value_float": float(mrr),
            },
            "UNIQUE_REVIEWED_PREFERENCE_TOP1": _frac(self.unique_pref_top1_num, self.unique_pref_den)
            if self.unique_pref_den
            else {"numerator": 0, "denominator": 0, "value_unrounded": "NOT_APPLICABLE", "value_float": None},
            "no_hit_count": self.no_hit,
            "multiple_preferred_ambiguity_count": self.multi_preferred_ambiguity,
            "hit_rank_histogram": dict(sorted(self.hist.items())),
        }


def _frac(num: int, den: int) -> dict[str, Any]:
    if den == 0:
        return {
            "numerator": 0,
            "denominator": 0,
            "value_unrounded": "NOT_APPLICABLE",
            "value_float": None,
        }
    f = Fraction(num, den)
    return {
        "numerator": num,
        "denominator": den,
        "value_unrounded": str(f),
        "value_float": float(f),
    }


def score_r3c_target_case(
    *,
    case_id: str,
    produced: Sequence[ProducedCandidateView],
    acceptable_targets: Iterable[str],
    source_surface: str,
    unique_preference_targets: Iterable[str] | None = None,
    k: int = 5,
    structural_error: str | None = None,
) -> R3CTargetScore:
    targets = frozenset(acceptable_targets)
    ranked = list(produced)[:k]
    first: int | None = None
    for i, p in enumerate(ranked, start=1):
        if is_target_hit(
            surface=p.surface,
            is_identity=p.is_identity,
            kind=p.kind,
            source_surface=source_surface,
            acceptable_targets=targets,
        ):
            first = i
            break
    if structural_error:
        first = None
    if first is None:
        rr = Fraction(0, 1)
    else:
        rr = Fraction(1, first)
    identity_r1 = bool(ranked and ranked[0].is_identity)
    uniq_hit: bool | None = None
    if unique_preference_targets is not None:
        uniq = frozenset(unique_preference_targets)
        uniq_hit = bool(
            ranked
            and is_target_hit(
                surface=ranked[0].surface,
                is_identity=ranked[0].is_identity,
                kind=ranked[0].kind,
                source_surface=source_surface,
                acceptable_targets=uniq,
            )
            and len(uniq) == 1
        )
    return R3CTargetScore(
        case_id=case_id,
        first_target_rank=first,
        reciprocal_rank=rr,
        top1_hit=first == 1,
        recall_at_1=first == 1,
        recall_at_5=first is not None and first <= 5,
        unique_preference_top1_hit=uniq_hit,
        identity_at_rank_1=identity_r1,
        structural_error=structural_error,
    )


def validate_invariants(block: R3CPopulationBlock) -> list[str]:
    errs: list[str] = []
    if block.denominator == 0:
        return errs
    if block.top1_num != block.recall1_num:
        errs.append("target_top1 != target_recall_at_1")
    mrr = float(block.mrr_sum / block.denominator)
    top1 = block.top1_num / block.denominator
    r5 = block.recall5_num / block.denominator
    if not (top1 <= mrr + 1e-12 <= r5 + 1e-12):
        errs.append("invariant top1 <= MRR <= recall@5 violated")
    return errs
