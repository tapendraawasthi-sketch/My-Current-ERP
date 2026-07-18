"""MAI-07R3H2 canonical population/metric scorer.

Pure data-in/data-out scorer over authored gold cases and prediction envelopes.
No max(1, denominator); no hard-coded pass values. Every metric is bound to an
explicit EvaluationPopulation built from case suite_kind / gold fields, and
gates are evaluated only through build_metric / evaluate_gate so that empty
populations surface as NOT_APPLICABLE (optional) or INVALID_REQUIRED_POPULATION
(required) rather than silently defaulting.

This module intentionally contains the reference population/formula
definitions. The independent audit scorer
(eval_mai07_r3h2_audit_scorer.py) must NOT import from here — it
reimplements the same contract from the case/prediction schema directly so
that agreement between the two is real evidence, not shared-code coincidence.
"""

from __future__ import annotations

from typing import Any, Callable

from .r3h2_scoring_contracts import (
    CounterfactualGroupResult,
    EvaluationPopulation,
    GateResult,
    MetricResult,
    ScoreReport,
    SCORER_VERSION,
    build_metric,
    evaluate_gate,
)

SCORER_ID = "mai07_r3h2_canonical_scorer"

# Populations that must be non-empty for a given sealed/non-frozen split.
# Empty required populations fail as INVALID_REQUIRED_POPULATION; populations
# absent from a split are marked required=False so they become NOT_APPLICABLE.
SPLIT_REQUIRED_POPULATIONS: dict[str, frozenset[str]] = {
    "DEVELOPMENT": frozenset(
        {
            "clear_english",
            "clear_romanized_control",
            "shared_english_context",
            "shared_nepali_context",
            "ambiguous_review",
            "review_required_gold",
            "technical_english",
            "name_identity",
            "acronym_identifier",
            "protected",
            "oov",
            "counterfactual_pairs",
            "policy_eligible",
            "all_cases",
        }
    ),
    "HOLDOUT_VALIDATION": frozenset(
        {
            "clear_english",
            "clear_romanized_control",
            "shared_english_context",
            "shared_nepali_context",
            "ambiguous_review",
            "review_required_gold",
            "policy_eligible",
            "all_cases",
        }
    ),
    "SAFETY_CHALLENGE": frozenset(
        {
            "clear_english",
            "clear_romanized_control",
            "name_identity",
            "acronym_identifier",
            "protected",
            "ambiguous_review",
            "review_required_gold",
            "policy_eligible",
            "all_cases",
        }
    ),
    "CONTEXT_COUNTERFACTUAL": frozenset(
        {
            "shared_english_context",
            "shared_nepali_context",
            "ambiguous_review",
            "review_required_gold",
            "counterfactual_pairs",
            "policy_eligible",
            "all_cases",
        }
    ),
    "OOV_GENERALIZATION": frozenset({"oov", "clear_english", "policy_eligible", "all_cases"}),
    "MONOTONIC_PARENT_COMPARISON": frozenset(
        {"clear_english", "clear_romanized_control", "shared_english_context", "policy_eligible", "all_cases"}
    ),
}

ENGLISH_LIKE_SUITE_KINDS = frozenset(
    {
        "english_identity",
        "technical_english",
        "name_identity",
        "acronym_identifier",
        "oov_english_generalization",
    }
)
PROTECTED_SUITE_KINDS = frozenset({"protected_span", "protected_identifier"})
SHARED_ENGLISH_SUITE_KINDS = frozenset({"shared_collision_english_context", "counterfactual_english_context"})
SHARED_NEPALI_SUITE_KINDS = frozenset({"shared_collision_nepali_context", "counterfactual_nepali_context"})
AMBIGUOUS_SUITE_KINDS = frozenset({"shared_collision_ambiguous_context", "counterfactual_ambiguous_context"})
COUNTERFACTUAL_ROLES = ("english_context", "nepali_context", "ambiguous_context")


def _has_devanagari(text: str) -> bool:
    return any("\u0900" <= ch <= "\u097F" for ch in text or "")


def _top1(pred: dict[str, Any]) -> dict[str, Any] | None:
    ranked = pred.get("ranked") or []
    return ranked[0] if ranked else None


def _acceptable_targets(case: dict[str, Any]) -> frozenset[str]:
    return frozenset(case.get("acceptable_devanagari_targets") or ())


def _identity_correct(case: dict[str, Any], pred: dict[str, Any]) -> bool:
    top = _top1(pred)
    if top is None:
        return False
    source = pred.get("source_surface")
    return bool(top.get("is_identity")) and top.get("surface") == source


def _target_correct(case: dict[str, Any], pred: dict[str, Any]) -> bool:
    top = _top1(pred)
    if top is None:
        return False
    targets = _acceptable_targets(case)
    return (not top.get("is_identity")) and top.get("surface") in targets


def _role_correct(case: dict[str, Any], pred: dict[str, Any]) -> bool:
    """Generic per-role counterfactual correctness driven by gold identity_expected."""
    if case.get("identity_expected"):
        return _identity_correct(case, pred)
    return _target_correct(case, pred)


def _false_devanagari_on_clear_english(case: dict[str, Any], pred: dict[str, Any]) -> bool:
    top = _top1(pred)
    if top is None:
        return False
    return (not bool(top.get("is_identity"))) and _has_devanagari(str(top.get("surface") or ""))


def _has_candidate_duplication(pred: dict[str, Any]) -> bool:
    surfaces = pred.get("candidate_surfaces_sorted")
    if surfaces is None:
        surfaces = [c.get("surface") for c in (pred.get("ranked") or [])]
    return len(surfaces) != len(set(surfaces))


def build_populations(cases: list[dict[str, Any]]) -> dict[str, EvaluationPopulation]:
    def ids(predicate: Callable[[dict[str, Any]], bool]) -> tuple[str, ...]:
        return tuple(sorted(c["case_id"] for c in cases if predicate(c)))

    split_name = cases[0]["split"] if cases else ""
    required_ids = SPLIT_REQUIRED_POPULATIONS.get(split_name, frozenset({"all_cases", "policy_eligible"}))

    def req(population_id: str) -> bool:
        return population_id in required_ids

    populations: dict[str, EvaluationPopulation] = {}
    populations["clear_english"] = EvaluationPopulation(
        population_id="clear_english",
        case_ids=ids(lambda c: bool(c.get("identity_expected")) and c.get("suite_kind") in ENGLISH_LIKE_SUITE_KINDS),
        required=req("clear_english"),
        description="identity_expected cases whose suite_kind is an English-like family",
    )
    populations["clear_romanized_control"] = EvaluationPopulation(
        population_id="clear_romanized_control",
        case_ids=ids(lambda c: c.get("suite_kind") == "clear_romanized_control"),
        required=req("clear_romanized_control"),
        description="target-required: clear Romanized-Nepali control cases",
    )
    populations["shared_english_context"] = EvaluationPopulation(
        population_id="shared_english_context",
        case_ids=ids(lambda c: c.get("suite_kind") in SHARED_ENGLISH_SUITE_KINDS),
        required=req("shared_english_context"),
        description="shared-collision surfaces in English-favoring context (direct + counterfactual)",
    )
    populations["shared_nepali_context"] = EvaluationPopulation(
        population_id="shared_nepali_context",
        case_ids=ids(lambda c: c.get("suite_kind") in SHARED_NEPALI_SUITE_KINDS),
        required=req("shared_nepali_context"),
        description="target-required: shared-collision surfaces in Nepali-favoring context (direct + counterfactual)",
    )
    populations["ambiguous_review"] = EvaluationPopulation(
        population_id="ambiguous_review",
        case_ids=ids(lambda c: c.get("suite_kind") in AMBIGUOUS_SUITE_KINDS),
        required=req("ambiguous_review"),
        description="shared-collision surfaces in neutral/ambiguous context requiring review",
    )
    populations["technical_english"] = EvaluationPopulation(
        population_id="technical_english",
        case_ids=ids(lambda c: c.get("suite_kind") == "technical_english"),
        required=req("technical_english"),
    )
    populations["name_identity"] = EvaluationPopulation(
        population_id="name_identity",
        case_ids=ids(lambda c: c.get("suite_kind") == "name_identity"),
        required=req("name_identity"),
    )
    populations["acronym_identifier"] = EvaluationPopulation(
        population_id="acronym_identifier",
        case_ids=ids(lambda c: c.get("suite_kind") == "acronym_identifier"),
        required=req("acronym_identifier"),
    )
    populations["protected"] = EvaluationPopulation(
        population_id="protected",
        case_ids=ids(lambda c: c.get("suite_kind") in PROTECTED_SUITE_KINDS),
        required=req("protected"),
    )
    populations["oov"] = EvaluationPopulation(
        population_id="oov",
        case_ids=ids(lambda c: c.get("suite_kind") == "oov_english_generalization"),
        required=req("oov"),
    )
    populations["optional_target_ambiguous"] = EvaluationPopulation(
        population_id="optional_target_ambiguous",
        case_ids=ids(
            lambda c: c.get("suite_kind") in AMBIGUOUS_SUITE_KINDS and bool(c.get("acceptable_devanagari_targets"))
        ),
        required=False,
        description="optional: ambiguous cases carrying a non-empty acceptable Devanagari target set",
    )
    populations["review_required_gold"] = EvaluationPopulation(
        population_id="review_required_gold",
        case_ids=ids(lambda c: bool(c.get("requires_review"))),
        required=req("review_required_gold"),
        description="gold-labeled cases where review is required",
    )
    populations["policy_eligible"] = EvaluationPopulation(
        population_id="policy_eligible",
        case_ids=ids(lambda c: True),
        required=req("policy_eligible"),
        description="all cases must carry a span disposition after R3H2 policy attachment",
    )
    populations["all_cases"] = EvaluationPopulation(
        population_id="all_cases",
        case_ids=tuple(sorted(c["case_id"] for c in cases)),
        required=req("all_cases"),
    )
    return populations


def build_counterfactual_groups(
    cases: list[dict[str, Any]],
    by_pred: dict[str, dict[str, Any]],
) -> list[CounterfactualGroupResult]:
    by_case: dict[str, dict[str, Any]] = {c["case_id"]: c for c in cases}
    grouped: dict[str, dict[str, str]] = {}
    for case in cases:
        pair_id = case.get("pair_id")
        pair_role = case.get("pair_role")
        if not pair_id or pair_role not in COUNTERFACTUAL_ROLES:
            continue
        grouped.setdefault(pair_id, {})[pair_role] = case["case_id"]

    results: list[CounterfactualGroupResult] = []
    for pair_id, roles in sorted(grouped.items()):
        complete = all(role in roles for role in COUNTERFACTUAL_ROLES)
        role_ok: dict[str, bool] = {}
        for role in COUNTERFACTUAL_ROLES:
            cid = roles.get(role)
            if cid is None or cid not in by_pred:
                role_ok[role] = False
                continue
            role_ok[role] = _role_correct(by_case[cid], by_pred[cid])
        results.append(
            CounterfactualGroupResult(
                group_id=pair_id,
                english_ok=role_ok["english_context"],
                nepali_ok=role_ok["nepali_context"],
                ambiguous_ok=role_ok["ambiguous_context"],
                complete=complete,
            )
        )
    return results


def score_split(
    cases: list[dict[str, Any]],
    predictions: list[dict[str, Any]],
    thresholds: dict[str, Any] | None = None,
    *,
    measured_extras: dict[str, Any] | None = None,
) -> ScoreReport:
    by_case: dict[str, dict[str, Any]] = {c["case_id"]: c for c in cases}
    by_pred: dict[str, dict[str, Any]] = {p["case_id"]: p for p in predictions}
    populations = build_populations(cases)
    split_name = cases[0]["split"] if cases else ""
    gates_spec: dict[str, Any] = dict((thresholds or {}).get("gates") or {})

    metrics: dict[str, MetricResult] = {}
    gates: dict[str, GateResult] = {}

    def add_metric(
        metric_id: str,
        population_key: str,
        predicate: Callable[[dict[str, Any], dict[str, Any]], bool],
        *,
        required: bool | None = None,
    ) -> None:
        population = populations[population_key]
        numerator = sum(
            1 for cid in population.case_ids if cid in by_pred and predicate(by_case[cid], by_pred[cid])
        )
        spec = gates_spec.get(metric_id)
        metric = build_metric(
            metric_id=metric_id,
            population=population,
            numerator=numerator,
            required=required,
            threshold=(spec.get("value") if spec else None),
            operation=(spec.get("op") if spec else None),
        )
        metrics[metric_id] = metric
        gates[metric_id] = evaluate_gate(metric)

    add_metric("overall_english_identity_top1", "clear_english", _identity_correct)
    add_metric("false_devanagari_on_clear_english", "clear_english", _false_devanagari_on_clear_english)
    add_metric(
        "unresolved_shared_identity_review_accuracy",
        "ambiguous_review",
        lambda c, p: _identity_correct(c, p)
        and bool(p.get("span_review_required"))
        and len(p.get("span_review_reason_codes") or ()) > 0,
    )
    add_metric(
        "review_reason_code_completeness",
        "review_required_gold",
        lambda c, p: bool(p.get("span_review_required")) and len(p.get("span_review_reason_codes") or ()) > 0,
    )
    add_metric("english_context_identity_accuracy", "shared_english_context", _identity_correct)
    add_metric("nepali_context_target_accuracy", "shared_nepali_context", _target_correct)
    add_metric(
        "clear_romanized_target_generation_recall",
        "clear_romanized_control",
        lambda c, p: bool(p.get("pre_cap_has_acceptable_target")),
    )
    add_metric(
        "clear_romanized_target_recall_at_5",
        "clear_romanized_control",
        lambda c, p: bool(p.get("post_cap_has_acceptable_target")),
    )
    add_metric(
        "clear_romanized_target_missing_from_top5_rate",
        "clear_romanized_control",
        lambda c, p: not bool(p.get("post_cap_has_acceptable_target")),
    )
    add_metric(
        "shared_nepali_context_target_generation_recall",
        "shared_nepali_context",
        lambda c, p: bool(p.get("pre_cap_has_acceptable_target")),
    )
    add_metric(
        "shared_nepali_context_target_recall_at_5",
        "shared_nepali_context",
        lambda c, p: bool(p.get("post_cap_has_acceptable_target")),
    )
    add_metric(
        "ambiguous_optional_target_generation_recall",
        "optional_target_ambiguous",
        lambda c, p: bool(p.get("pre_cap_has_acceptable_target")),
        required=False,
    )
    add_metric(
        "ambiguous_optional_target_retention_at_5",
        "optional_target_ambiguous",
        lambda c, p: bool(p.get("post_cap_has_acceptable_target")),
        required=False,
    )
    add_metric("technical_english_identity_top1", "technical_english", _identity_correct)
    add_metric("name_identity_top1", "name_identity", _identity_correct)
    add_metric("acronym_identifier_identity_top1", "acronym_identifier", _identity_correct)
    add_metric("protected_span_mutations", "protected", lambda c, p: bool(p.get("protected_mutations")))
    add_metric("raw_view_mutations", "all_cases", lambda c, p: not bool(p.get("raw_ok")))
    add_metric("caps_respected", "all_cases", lambda c, p: bool(p.get("caps_ok")))
    add_metric("candidate_duplication", "all_cases", lambda c, p: _has_candidate_duplication(p))
    add_metric("policy_invocation_coverage", "policy_eligible", lambda c, p: bool(p.get("policy_invoked")))

    # target_dropped_by_cap_rate: dynamic population of cases where generation produced an
    # acceptable target pre-cap, drawn from every target-bearing population (never hard-coded).
    target_bearing_ids = (
        populations["clear_romanized_control"].case_ids
        + populations["shared_nepali_context"].case_ids
        + populations["optional_target_ambiguous"].case_ids
    )
    pre_cap_positive_ids = tuple(
        sorted(
            {
                cid
                for cid in target_bearing_ids
                if cid in by_pred and bool(by_pred[cid].get("pre_cap_has_acceptable_target"))
            }
        )
    )
    target_generation_population = EvaluationPopulation(
        population_id="target_generation_positive",
        case_ids=pre_cap_positive_ids,
        required=False,
        description="cases where an acceptable Devanagari target existed pre-cap (any target-bearing population)",
    )
    populations["target_generation_positive"] = target_generation_population
    add_metric(
        "target_dropped_by_cap_rate",
        "target_generation_positive",
        lambda c, p: not bool(p.get("post_cap_has_acceptable_target")),
        required=False,
    )

    # complete_counterfactual_triple_accuracy: population is the set of complete pair_ids.
    groups = build_counterfactual_groups(cases, by_pred)
    complete_groups = [g for g in groups if g.complete]
    pair_population = EvaluationPopulation(
        population_id="counterfactual_pairs",
        case_ids=tuple(g.group_id for g in complete_groups),
        required=("counterfactual_pairs" in SPLIT_REQUIRED_POPULATIONS.get(split_name, frozenset())),
        description="complete english_context/nepali_context/ambiguous_context counterfactual triples",
    )
    populations["counterfactual_pairs"] = pair_population
    triple_numerator = sum(1 for g in complete_groups if g.all_ok)
    spec = gates_spec.get("complete_counterfactual_triple_accuracy")
    triple_metric = build_metric(
        metric_id="complete_counterfactual_triple_accuracy",
        population=pair_population,
        numerator=triple_numerator,
        required=pair_population.required,
        threshold=(spec.get("value") if spec else None),
        operation=(spec.get("op") if spec else None),
    )
    metrics["complete_counterfactual_triple_accuracy"] = triple_metric
    gates["complete_counterfactual_triple_accuracy"] = evaluate_gate(triple_metric)

    extras: dict[str, Any] = dict(measured_extras or {})
    extras.setdefault("prediction_count", len(predictions))
    extras.setdefault("case_count", len(cases))
    extras.setdefault(
        "parity_determinism_harm_note",
        "cross_path_parity / deterministic_output / harm_count fields, when present, are measured "
        "by the eval runner via repeated/dual-path invocation and merged into extras by the caller; "
        "this scorer never fabricates a pass value for them.",
    )

    return ScoreReport(
        scorer_id=SCORER_ID,
        scorer_version=SCORER_VERSION,
        split=split_name,
        populations=populations,
        metrics=metrics,
        gates=gates,
        counterfactual_groups=groups,
        extras=extras,
    )
