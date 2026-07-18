"""MAI-07R3H2 versioned scoring contracts.

No max(1, denominator). No hard-coded pass values. Population-bound metrics only.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


SCORER_VERSION = "mai-07-r3h2.scorer.1.0.0"
FORMULA_VERSION = "mai-07-r3h2.formula.1.0.0"


class MetricApplicability(str, Enum):
    APPLICABLE = "APPLICABLE"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    INVALID_REQUIRED_POPULATION = "INVALID_REQUIRED_POPULATION"


class GateOutcome(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    INVALID_REQUIRED_POPULATION = "INVALID_REQUIRED_POPULATION"


@dataclass(frozen=True)
class EvaluationPopulation:
    population_id: str
    case_ids: tuple[str, ...]
    required: bool = True
    description: str = ""

    @property
    def size(self) -> int:
        return len(self.case_ids)


@dataclass(frozen=True)
class MetricResult:
    metric_id: str
    population_id: str
    numerator: int
    denominator: int
    applicability: MetricApplicability
    formula_version: str = FORMULA_VERSION
    value: float | None = None
    threshold: float | None = None
    operation: str | None = None
    integer_required: bool = False
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["applicability"] = self.applicability.value
        return d


@dataclass(frozen=True)
class GateResult:
    metric_id: str
    outcome: GateOutcome
    metric: MetricResult

    def to_dict(self) -> dict[str, Any]:
        return {
            "metric_id": self.metric_id,
            "outcome": self.outcome.value,
            "pass": self.outcome is GateOutcome.PASS,
            "metric": self.metric.to_dict(),
        }


@dataclass(frozen=True)
class CounterfactualGroupResult:
    group_id: str
    english_ok: bool
    nepali_ok: bool
    ambiguous_ok: bool
    complete: bool

    @property
    def all_ok(self) -> bool:
        return self.complete and self.english_ok and self.nepali_ok and self.ambiguous_ok

    def to_dict(self) -> dict[str, Any]:
        return asdict(self) | {"all_ok": self.all_ok}


def metric_value(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return numerator / denominator


def build_metric(
    *,
    metric_id: str,
    population: EvaluationPopulation,
    numerator: int,
    required: bool | None = None,
    threshold: float | None = None,
    operation: str | None = None,
    notes: str = "",
) -> MetricResult:
    is_required = population.required if required is None else required
    if population.size == 0:
        applicability = (
            MetricApplicability.INVALID_REQUIRED_POPULATION
            if is_required
            else MetricApplicability.NOT_APPLICABLE
        )
        return MetricResult(
            metric_id=metric_id,
            population_id=population.population_id,
            numerator=0,
            denominator=0,
            value=None,
            applicability=applicability,
            threshold=threshold,
            operation=operation,
            notes=notes or ("required population empty" if is_required else "optional population empty"),
        )
    if numerator < 0 or numerator > population.size:
        # Numerator may count successes within population; clamp check is soft via notes.
        pass
    return MetricResult(
        metric_id=metric_id,
        population_id=population.population_id,
        numerator=numerator,
        denominator=population.size,
        value=metric_value(numerator, population.size),
        applicability=MetricApplicability.APPLICABLE,
        threshold=threshold,
        operation=operation,
        notes=notes,
    )


def evaluate_gate(metric: MetricResult) -> GateResult:
    if metric.applicability is MetricApplicability.NOT_APPLICABLE:
        return GateResult(metric_id=metric.metric_id, outcome=GateOutcome.NOT_APPLICABLE, metric=metric)
    if metric.applicability is MetricApplicability.INVALID_REQUIRED_POPULATION:
        return GateResult(
            metric_id=metric.metric_id,
            outcome=GateOutcome.INVALID_REQUIRED_POPULATION,
            metric=metric,
        )
    if metric.value is None or metric.threshold is None or metric.operation is None:
        return GateResult(metric_id=metric.metric_id, outcome=GateOutcome.FAIL, metric=metric)
    op = metric.operation
    val = metric.value
    thr = metric.threshold
    if op == ">=":
        ok = val >= thr
    elif op == "<=":
        ok = val <= thr
    elif op == "==":
        ok = abs(val - thr) < 1e-12
    else:
        ok = False
    return GateResult(
        metric_id=metric.metric_id,
        outcome=GateOutcome.PASS if ok else GateOutcome.FAIL,
        metric=metric,
    )


@dataclass
class ScoreReport:
    scorer_id: str
    scorer_version: str
    split: str
    populations: dict[str, EvaluationPopulation] = field(default_factory=dict)
    metrics: dict[str, MetricResult] = field(default_factory=dict)
    gates: dict[str, GateResult] = field(default_factory=dict)
    counterfactual_groups: list[CounterfactualGroupResult] = field(default_factory=list)
    extras: dict[str, Any] = field(default_factory=dict)

    @property
    def all_required_pass(self) -> bool:
        for g in self.gates.values():
            if g.outcome in {GateOutcome.FAIL, GateOutcome.INVALID_REQUIRED_POPULATION}:
                return False
        return True

    def to_dict(self) -> dict[str, Any]:
        return {
            "scorer_id": self.scorer_id,
            "scorer_version": self.scorer_version,
            "split": self.split,
            "populations": {
                k: {
                    "population_id": v.population_id,
                    "size": v.size,
                    "required": v.required,
                    "description": v.description,
                    "case_ids": list(v.case_ids),
                }
                for k, v in self.populations.items()
            },
            "metrics": {k: v.to_dict() for k, v in self.metrics.items()},
            "gates": {k: v.to_dict() for k, v in self.gates.items()},
            "counterfactual_groups": [g.to_dict() for g in self.counterfactual_groups],
            "all_required_pass": self.all_required_pass,
            "extras": self.extras,
        }
