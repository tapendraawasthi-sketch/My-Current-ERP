"""MAI-07R3H2 independent audit scorer.

Clean-room reimplementation used to verify the canonical scorer
(eval_mai07_r3h2_canonical_scorer.py) by agreement, not by shared code. This
module MUST NOT import eval_mai07_r3h2_canonical_scorer or any canonical
population-builder function. It only depends on r3h2_scoring_contracts
(shared enums/dataclasses/gate math) and re-derives population membership and
metric formulas directly from the case/prediction schema.

compare_reports() requires exact agreement on metric ids, numerators,
denominators, applicability, and gate outcomes between the two independently
produced ScoreReport objects.
"""

from __future__ import annotations

from typing import Any

from .r3h2_scoring_contracts import (
    CounterfactualGroupResult,
    EvaluationPopulation,
    GateOutcome,
    MetricApplicability,
    ScoreReport,
    SCORER_VERSION,
    build_metric,
    evaluate_gate,
)

AUDIT_SCORER_ID = "mai07_r3h2_audit_scorer"

_DEVANAGARI_LOW = 0x0900
_DEVANAGARI_HIGH = 0x097F

_ENGLISH_FAMILY = (
    "english_identity",
    "technical_english",
    "name_identity",
    "acronym_identifier",
    "oov_english_generalization",
)
_PROTECTED_FAMILY = ("protected_span", "protected_identifier")
_SHARED_ENGLISH_FAMILY = ("shared_collision_english_context", "counterfactual_english_context")
_SHARED_NEPALI_FAMILY = ("shared_collision_nepali_context", "counterfactual_nepali_context")
_AMBIGUOUS_FAMILY = ("shared_collision_ambiguous_context", "counterfactual_ambiguous_context")
_TRIPLE_ROLES = ("english_context", "nepali_context", "ambiguous_context")

# Duplicated intentionally — audit scorer must not import canonical helpers.
_SPLIT_REQUIRED_POPULATIONS: dict[str, frozenset[str]] = {
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


def _contains_devanagari_codepoint(text: str | None) -> bool:
    if not text:
        return False
    return any(_DEVANAGARI_LOW <= ord(ch) <= _DEVANAGARI_HIGH for ch in text)


def _leading_candidate(prediction: dict[str, Any]) -> dict[str, Any] | None:
    seq = prediction.get("ranked")
    if not seq:
        return None
    return seq[0]


def _gold_target_set(case_row: dict[str, Any]) -> set[str]:
    return set(case_row.get("acceptable_devanagari_targets") or [])


def _top_matches_identity(case_row: dict[str, Any], prediction: dict[str, Any]) -> bool:
    lead = _leading_candidate(prediction)
    if lead is None:
        return False
    if not lead.get("is_identity"):
        return False
    return lead.get("surface") == prediction.get("source_surface")


def _top_matches_target(case_row: dict[str, Any], prediction: dict[str, Any]) -> bool:
    lead = _leading_candidate(prediction)
    if lead is None:
        return False
    if lead.get("is_identity"):
        return False
    return lead.get("surface") in _gold_target_set(case_row)


def _counterfactual_role_pass(case_row: dict[str, Any], prediction: dict[str, Any]) -> bool:
    if case_row.get("identity_expected"):
        return _top_matches_identity(case_row, prediction)
    return _top_matches_target(case_row, prediction)


def _duplicated_candidate_surfaces(prediction: dict[str, Any]) -> bool:
    listed = prediction.get("candidate_surfaces_sorted")
    if listed is None:
        listed = [entry.get("surface") for entry in (prediction.get("ranked") or [])]
    return len(list(listed)) != len(set(listed))


def partition_case_ids(case_rows: list[dict[str, Any]]) -> dict[str, tuple[str, ...]]:
    """Independent re-derivation of population membership from raw case fields."""
    buckets: dict[str, list[str]] = {
        "clear_english": [],
        "clear_romanized_control": [],
        "shared_english_context": [],
        "shared_nepali_context": [],
        "ambiguous_review": [],
        "technical_english": [],
        "name_identity": [],
        "acronym_identifier": [],
        "protected": [],
        "oov": [],
        "optional_target_ambiguous": [],
        "review_required_gold": [],
        "policy_eligible": [],
        "all_cases": [],
    }
    for row in case_rows:
        cid = row["case_id"]
        suite = row.get("suite_kind")
        buckets["all_cases"].append(cid)
        buckets["policy_eligible"].append(cid)
        if row.get("identity_expected") and suite in _ENGLISH_FAMILY:
            buckets["clear_english"].append(cid)
        if suite == "clear_romanized_control":
            buckets["clear_romanized_control"].append(cid)
        if suite in _SHARED_ENGLISH_FAMILY:
            buckets["shared_english_context"].append(cid)
        if suite in _SHARED_NEPALI_FAMILY:
            buckets["shared_nepali_context"].append(cid)
        if suite in _AMBIGUOUS_FAMILY:
            buckets["ambiguous_review"].append(cid)
            if row.get("acceptable_devanagari_targets"):
                buckets["optional_target_ambiguous"].append(cid)
        if suite == "technical_english":
            buckets["technical_english"].append(cid)
        if suite == "name_identity":
            buckets["name_identity"].append(cid)
        if suite == "acronym_identifier":
            buckets["acronym_identifier"].append(cid)
        if suite in _PROTECTED_FAMILY:
            buckets["protected"].append(cid)
        if suite == "oov_english_generalization":
            buckets["oov"].append(cid)
        if row.get("requires_review"):
            buckets["review_required_gold"].append(cid)
    return {key: tuple(sorted(value)) for key, value in buckets.items()}


def rebuild_populations(case_rows: list[dict[str, Any]]) -> dict[str, EvaluationPopulation]:
    partitions = partition_case_ids(case_rows)
    split_name = case_rows[0]["split"] if case_rows else ""
    required_ids = _SPLIT_REQUIRED_POPULATIONS.get(split_name, frozenset({"all_cases", "policy_eligible"}))
    return {
        key: EvaluationPopulation(
            population_id=key,
            case_ids=ids,
            required=(False if key == "optional_target_ambiguous" else key in required_ids),
        )
        for key, ids in partitions.items()
    }


def rebuild_counterfactual_groups(
    case_rows: list[dict[str, Any]],
    prediction_index: dict[str, dict[str, Any]],
) -> list[CounterfactualGroupResult]:
    case_index = {row["case_id"]: row for row in case_rows}
    triples: dict[str, dict[str, str]] = {}
    for row in case_rows:
        pid = row.get("pair_id")
        role = row.get("pair_role")
        if not pid or role not in _TRIPLE_ROLES:
            continue
        triples.setdefault(pid, {})[role] = row["case_id"]

    out: list[CounterfactualGroupResult] = []
    for pid in sorted(triples):
        role_case_ids = triples[pid]
        is_complete = all(role in role_case_ids for role in _TRIPLE_ROLES)
        passed: dict[str, bool] = {}
        for role in _TRIPLE_ROLES:
            cid = role_case_ids.get(role)
            if cid is None or cid not in prediction_index:
                passed[role] = False
                continue
            passed[role] = _counterfactual_role_pass(case_index[cid], prediction_index[cid])
        out.append(
            CounterfactualGroupResult(
                group_id=pid,
                english_ok=passed["english_context"],
                nepali_ok=passed["nepali_context"],
                ambiguous_ok=passed["ambiguous_context"],
                complete=is_complete,
            )
        )
    return out


def score_split_audit(
    case_rows: list[dict[str, Any]],
    prediction_rows: list[dict[str, Any]],
    thresholds: dict[str, Any] | None = None,
    *,
    measured_extras: dict[str, Any] | None = None,
) -> ScoreReport:
    case_index = {row["case_id"]: row for row in case_rows}
    prediction_index = {row["case_id"]: row for row in prediction_rows}
    populations = rebuild_populations(case_rows)
    gate_specs = dict((thresholds or {}).get("gates") or {})

    metrics: dict[str, Any] = {}
    gates: dict[str, Any] = {}

    def score_one(metric_id: str, population_key: str, wins: int, *, required: bool | None = None) -> None:
        population = populations[population_key]
        spec = gate_specs.get(metric_id)
        metric = build_metric(
            metric_id=metric_id,
            population=population,
            numerator=wins,
            required=required,
            threshold=(spec.get("value") if spec else None),
            operation=(spec.get("op") if spec else None),
        )
        metrics[metric_id] = metric
        gates[metric_id] = evaluate_gate(metric)

    def count_over(population_key: str, ok_fn) -> int:
        population = populations[population_key]
        total = 0
        for cid in population.case_ids:
            pred = prediction_index.get(cid)
            if pred is None:
                continue
            if ok_fn(case_index[cid], pred):
                total += 1
        return total

    score_one("overall_english_identity_top1", "clear_english", count_over("clear_english", _top_matches_identity))
    score_one(
        "false_devanagari_on_clear_english",
        "clear_english",
        count_over(
            "clear_english",
            lambda c, p: bool(_leading_candidate(p))
            and not _leading_candidate(p).get("is_identity")
            and _contains_devanagari_codepoint(_leading_candidate(p).get("surface")),
        ),
    )
    score_one(
        "unresolved_shared_identity_review_accuracy",
        "ambiguous_review",
        count_over(
            "ambiguous_review",
            lambda c, p: _top_matches_identity(c, p)
            and bool(p.get("span_review_required"))
            and len(p.get("span_review_reason_codes") or ()) > 0,
        ),
    )
    score_one(
        "review_reason_code_completeness",
        "review_required_gold",
        count_over(
            "review_required_gold",
            lambda c, p: bool(p.get("span_review_required")) and len(p.get("span_review_reason_codes") or ()) > 0,
        ),
    )
    score_one(
        "english_context_identity_accuracy",
        "shared_english_context",
        count_over("shared_english_context", _top_matches_identity),
    )
    score_one(
        "nepali_context_target_accuracy",
        "shared_nepali_context",
        count_over("shared_nepali_context", _top_matches_target),
    )
    score_one(
        "clear_romanized_target_generation_recall",
        "clear_romanized_control",
        count_over("clear_romanized_control", lambda c, p: bool(p.get("pre_cap_has_acceptable_target"))),
    )
    score_one(
        "clear_romanized_target_recall_at_5",
        "clear_romanized_control",
        count_over("clear_romanized_control", lambda c, p: bool(p.get("post_cap_has_acceptable_target"))),
    )
    score_one(
        "clear_romanized_target_missing_from_top5_rate",
        "clear_romanized_control",
        count_over("clear_romanized_control", lambda c, p: not bool(p.get("post_cap_has_acceptable_target"))),
    )
    score_one(
        "shared_nepali_context_target_generation_recall",
        "shared_nepali_context",
        count_over("shared_nepali_context", lambda c, p: bool(p.get("pre_cap_has_acceptable_target"))),
    )
    score_one(
        "shared_nepali_context_target_recall_at_5",
        "shared_nepali_context",
        count_over("shared_nepali_context", lambda c, p: bool(p.get("post_cap_has_acceptable_target"))),
    )
    score_one(
        "ambiguous_optional_target_generation_recall",
        "optional_target_ambiguous",
        count_over("optional_target_ambiguous", lambda c, p: bool(p.get("pre_cap_has_acceptable_target"))),
        required=False,
    )
    score_one(
        "ambiguous_optional_target_retention_at_5",
        "optional_target_ambiguous",
        count_over("optional_target_ambiguous", lambda c, p: bool(p.get("post_cap_has_acceptable_target"))),
        required=False,
    )
    score_one(
        "technical_english_identity_top1", "technical_english", count_over("technical_english", _top_matches_identity)
    )
    score_one("name_identity_top1", "name_identity", count_over("name_identity", _top_matches_identity))
    score_one(
        "acronym_identifier_identity_top1", "acronym_identifier", count_over("acronym_identifier", _top_matches_identity)
    )
    score_one(
        "protected_span_mutations", "protected", count_over("protected", lambda c, p: bool(p.get("protected_mutations")))
    )
    score_one("raw_view_mutations", "all_cases", count_over("all_cases", lambda c, p: not bool(p.get("raw_ok"))))
    score_one("caps_respected", "all_cases", count_over("all_cases", lambda c, p: bool(p.get("caps_ok"))))
    score_one(
        "candidate_duplication", "all_cases", count_over("all_cases", lambda c, p: _duplicated_candidate_surfaces(p))
    )
    score_one(
        "policy_invocation_coverage",
        "policy_eligible",
        count_over("policy_eligible", lambda c, p: bool(p.get("policy_invoked"))),
    )

    target_bearing = (
        populations["clear_romanized_control"].case_ids
        + populations["shared_nepali_context"].case_ids
        + populations["optional_target_ambiguous"].case_ids
    )
    pre_cap_positive = tuple(
        sorted(
            {
                cid
                for cid in target_bearing
                if cid in prediction_index and bool(prediction_index[cid].get("pre_cap_has_acceptable_target"))
            }
        )
    )
    target_gen_population = EvaluationPopulation(
        population_id="target_generation_positive", case_ids=pre_cap_positive, required=False
    )
    populations["target_generation_positive"] = target_gen_population
    dropped = sum(
        1
        for cid in pre_cap_positive
        if not bool(prediction_index[cid].get("post_cap_has_acceptable_target"))
    )
    score_one("target_dropped_by_cap_rate", "target_generation_positive", dropped, required=False)

    groups = rebuild_counterfactual_groups(case_rows, prediction_index)
    complete = [g for g in groups if g.complete]
    split_name = case_rows[0]["split"] if case_rows else ""
    pair_required = "counterfactual_pairs" in _SPLIT_REQUIRED_POPULATIONS.get(split_name, frozenset())
    pair_population = EvaluationPopulation(
        population_id="counterfactual_pairs",
        case_ids=tuple(g.group_id for g in complete),
        required=pair_required,
    )
    populations["counterfactual_pairs"] = pair_population
    triple_wins = sum(1 for g in complete if g.all_ok)
    score_one(
        "complete_counterfactual_triple_accuracy",
        "counterfactual_pairs",
        triple_wins,
        required=pair_required,
    )

    extras = dict(measured_extras or {})
    extras.setdefault("prediction_count", len(prediction_rows))
    extras.setdefault("case_count", len(case_rows))

    return ScoreReport(
        scorer_id=AUDIT_SCORER_ID,
        scorer_version=SCORER_VERSION,
        split=split_name,
        populations=populations,
        metrics=metrics,
        gates=gates,
        counterfactual_groups=groups,
        extras=extras,
    )


def compare_reports(canonical: ScoreReport, audit: ScoreReport) -> dict[str, Any]:
    """Require exact agreement on metric ids, nums, dens, applicability, gate outcomes."""
    mismatches: list[dict[str, Any]] = []
    canonical_ids = set(canonical.metrics)
    audit_ids = set(audit.metrics)
    if canonical_ids != audit_ids:
        mismatches.append(
            {
                "kind": "metric_id_set_mismatch",
                "only_in_canonical": sorted(canonical_ids - audit_ids),
                "only_in_audit": sorted(audit_ids - canonical_ids),
            }
        )

    per_metric: dict[str, Any] = {}
    for metric_id in sorted(canonical_ids & audit_ids):
        c_metric = canonical.metrics[metric_id]
        a_metric = audit.metrics[metric_id]
        c_gate = canonical.gates.get(metric_id)
        a_gate = audit.gates.get(metric_id)
        field_agreement = {
            "numerator": c_metric.numerator == a_metric.numerator,
            "denominator": c_metric.denominator == a_metric.denominator,
            "applicability": c_metric.applicability == a_metric.applicability,
            "gate_outcome": (c_gate.outcome if c_gate else None) == (a_gate.outcome if a_gate else None),
        }
        ok = all(field_agreement.values())
        per_metric[metric_id] = {
            "ok": ok,
            "canonical": {
                "numerator": c_metric.numerator,
                "denominator": c_metric.denominator,
                "applicability": c_metric.applicability.value
                if isinstance(c_metric.applicability, MetricApplicability)
                else c_metric.applicability,
                "gate_outcome": c_gate.outcome.value if isinstance(c_gate.outcome, GateOutcome) else None,
            },
            "audit": {
                "numerator": a_metric.numerator,
                "denominator": a_metric.denominator,
                "applicability": a_metric.applicability.value
                if isinstance(a_metric.applicability, MetricApplicability)
                else a_metric.applicability,
                "gate_outcome": a_gate.outcome.value if isinstance(a_gate.outcome, GateOutcome) else None,
            },
            "field_agreement": field_agreement,
        }
        if not ok:
            mismatches.append({"kind": "metric_disagreement", "metric_id": metric_id, "detail": per_metric[metric_id]})

    canonical_groups = {g.group_id: g for g in canonical.counterfactual_groups}
    audit_groups = {g.group_id: g for g in audit.counterfactual_groups}
    if set(canonical_groups) != set(audit_groups):
        mismatches.append({"kind": "counterfactual_group_set_mismatch"})
    else:
        for gid, cg in canonical_groups.items():
            ag = audit_groups[gid]
            if cg.to_dict() != ag.to_dict():
                mismatches.append({"kind": "counterfactual_group_disagreement", "group_id": gid})

    return {
        "ok": not mismatches,
        "canonical_scorer_id": canonical.scorer_id,
        "audit_scorer_id": audit.scorer_id,
        "metric_count_compared": len(per_metric),
        "per_metric": per_metric,
        "mismatches": mismatches,
    }
