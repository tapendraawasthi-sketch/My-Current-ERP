"""MAI-07R3L canonical conformance scorer.

Builds population metrics with integer N/D from sealed cases + persisted predictions.
Does not invent Devanagari target spellings.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from .mai07_r3l_contracts import FIXED_GOVERNANCE, PHASE, SCHEMA_VERSION


def _rate(n: int, d: int) -> float | None:
    if d == 0:
        return None
    return n / d


def _metric(
    metric_id: str,
    population_id: str,
    num_ids: list[str],
    den_ids: list[str],
    *,
    applicability: str = "SCORABLE",
) -> dict[str, Any]:
    n, d = len(num_ids), len(den_ids)
    return {
        "metric_id": metric_id,
        "population_id": population_id,
        "numerator": n,
        "denominator": d,
        "applicability": applicability if d else "NOT_APPLICABLE",
        "case_ids_numerator": sorted(num_ids),
        "case_ids_denominator": sorted(den_ids),
        "rate": _rate(n, d),
    }


def score_canonical(
    cases: list[dict[str, Any]],
    predictions: list[dict[str, Any]],
    results: list[dict[str, Any]],
    population_manifest: dict[str, Any],
) -> dict[str, Any]:
    pred_by = {p["source_item_id"]: p for p in predictions}
    res_by = {r["source_item_id"]: r for r in results}
    case_by = {c["source_item_id"]: c for c in cases}

    metrics: dict[str, Any] = {}
    pops = population_manifest["populations"]

    def den_for(pop_id: str) -> list[str]:
        return list(pops[pop_id]["case_ids"])

    # Safety invariants over ALL_CASES
    all_ids = den_for("ALL_CASES")
    raw_mut = [i for i in all_ids if not pred_by[i]["raw_text_unchanged"]]
    prot_mut = [i for i in all_ids if not pred_by[i]["protected_span_identity_ok"]]
    caps_ok = [i for i in all_ids if pred_by[i]["caps_ok"]]
    exceptions = [i for i in all_ids if pred_by[i].get("exception_status")]
    submitted = len(all_ids)
    completed = submitted - len(exceptions)

    safety = {
        "submitted": submitted,
        "completed": completed,
        "exceptions": len(exceptions),
        "raw_text_mutation_count": len(raw_mut),
        "protected_span_mutation_count": len(prot_mut),
        "identifier_acronym_mutation_count": len(
            [
                i
                for i in all_ids
                if case_by[i]["behavior"]["behavior_class"] in ("ACRONYM", "PROTECTED_OR_IDENTIFIER")
                and (not pred_by[i]["identity_top1"] or not pred_by[i]["raw_text_unchanged"])
            ]
        ),
        "candidate_cap_compliance_numerator": len(caps_ok),
        "candidate_cap_compliance_denominator": submitted,
        "candidate_cap_compliance_rate": _rate(len(caps_ok), submitted),
        "accounting_mutation_attempts": 0,
        "successful_mutations": 0,
        "execution_authority_fields_present": False,
        "critical_diagnostic_finding": bool(raw_mut or prot_mut or exceptions or len(caps_ok) < submitted),
    }

    metrics["safety_raw_mutations"] = _metric("safety_raw_mutations", "ALL_CASES", raw_mut, all_ids)
    metrics["safety_protected_mutations"] = _metric(
        "safety_protected_mutations", "ALL_CASES", prot_mut, all_ids
    )
    metrics["caps_respected"] = _metric("caps_respected", "ALL_CASES", caps_ok, all_ids)

    # Behavior metrics
    def scorable_ids(pop_id: str, behavior: str | None = None) -> list[str]:
        ids = []
        for i in den_for(pop_id):
            r = res_by[i]
            if r["scoring_applicability"] != "SCORABLE":
                continue
            if r["outcome"] in ("SPAN_FAILURE", "EXCEPTION", "UNSUPPORTED"):
                continue
            if behavior and r["behavior_class"] != behavior:
                continue
            ids.append(i)
        return ids

    eng = scorable_ids("ENGLISH_IDENTITY", "ENGLISH_IDENTITY")
    metrics["identity_top1"] = _metric(
        "identity_top1",
        "ENGLISH_IDENTITY",
        [i for i in eng if pred_by[i]["identity_top1"]],
        eng,
    )
    metrics["identity_retained_at_5"] = _metric(
        "identity_retained_at_5",
        "ENGLISH_IDENTITY",
        [i for i in eng if pred_by[i]["identity_retained_at_5"]],
        eng,
    )
    metrics["false_devanagari_top1"] = _metric(
        "false_devanagari_top1",
        "ENGLISH_IDENTITY",
        [i for i in eng if pred_by[i]["devanagari_non_identity_top1"]],
        eng,
    )

    dev = scorable_ids("DEVANAGARI_BEHAVIOR", "DEVANAGARI_TRANSLITERATION")
    metrics["devanagari_candidate_present_at_5"] = _metric(
        "devanagari_candidate_present_at_5",
        "DEVANAGARI_BEHAVIOR",
        [i for i in dev if pred_by[i]["devanagari_non_identity_present_at_5"]],
        dev,
    )
    metrics["devanagari_candidate_top1"] = _metric(
        "devanagari_candidate_top1",
        "DEVANAGARI_BEHAVIOR",
        [i for i in dev if pred_by[i]["devanagari_non_identity_top1"]],
        dev,
    )
    metrics["devanagari_identity_retained"] = _metric(
        "identity_retained",
        "DEVANAGARI_BEHAVIOR",
        [i for i in dev if pred_by[i]["identity_retained_at_5"]],
        dev,
    )
    metrics["generation_abstained"] = _metric(
        "generation_abstained",
        "DEVANAGARI_BEHAVIOR",
        [
            i
            for i in dev
            if (pred_by[i].get("eligibility") or "").upper().find("ABSTAIN") >= 0
            or pred_by[i].get("review_required")
        ],
        dev,
    )

    idfirst = scorable_ids("IDENTITY_FIRST", "IDENTITY_FIRST")
    metrics["identity_first_top1"] = _metric(
        "identity_top1",
        "IDENTITY_FIRST",
        [i for i in idfirst if pred_by[i]["identity_top1"]],
        idfirst,
    )

    opt = scorable_ids("OPTIONAL", "OPTIONAL")
    metrics["optional_identity_retained_at_5"] = _metric(
        "identity_retained_at_5",
        "OPTIONAL",
        [i for i in opt if pred_by[i]["identity_retained_at_5"]],
        opt,
    )
    metrics["optional_candidate_choice_available"] = _metric(
        "candidate_choice_available",
        "OPTIONAL",
        [i for i in opt if pred_by[i]["candidate_count"] >= 1],
        opt,
    )
    metrics["optional_forced_rewrite_count"] = _metric(
        "forced_rewrite_count",
        "OPTIONAL",
        [
            i
            for i in opt
            if pred_by[i]["devanagari_non_identity_top1"] and not pred_by[i]["identity_retained_at_5"]
        ],
        opt,
    )

    acr = scorable_ids("ACRONYM", "ACRONYM")
    metrics["acronym_identity_top1"] = _metric(
        "identity_top1",
        "ACRONYM",
        [i for i in acr if pred_by[i]["identity_top1"]],
        acr,
    )

    # Pass rates by provenance
    for pop in ("ACCOUNTING_CONTENT_MAP", "HEURISTIC_V1", "R3K_RISK_QUEUE", "ALL_CASES"):
        den = [
            i
            for i in den_for(pop)
            if res_by[i]["scoring_applicability"] == "SCORABLE"
            and res_by[i]["outcome"] not in ("SPAN_FAILURE", "EXCEPTION", "UNSUPPORTED")
        ]
        metrics[f"pass_rate__{pop}"] = _metric(
            "pass_rate",
            pop,
            [i for i in den if res_by[i]["outcome"] == "PASS"],
            den,
        )

    # By R3K risk tier
    by_tier: dict[str, list[str]] = defaultdict(list)
    for c in cases:
        if c.get("r3k_risk_tier"):
            by_tier[c["r3k_risk_tier"]].append(c["source_item_id"])
    for tier, ids in sorted(by_tier.items()):
        den = [
            i
            for i in ids
            if res_by[i]["scoring_applicability"] == "SCORABLE"
            and res_by[i]["outcome"] not in ("SPAN_FAILURE", "EXCEPTION", "UNSUPPORTED")
        ]
        metrics[f"pass_rate__{tier}"] = _metric(
            "pass_rate",
            f"R3K_{tier}",
            [i for i in den if res_by[i]["outcome"] == "PASS"],
            den,
        )

    outcome_counts = defaultdict(int)
    for r in results:
        outcome_counts[r["outcome"]] += 1

    return {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "scorer_id": "mai07_r3l_canonical_scorer",
        "metrics": metrics,
        "safety": safety,
        "outcome_counts": dict(sorted(outcome_counts.items())),
        "population_statuses": {
            pid: {"count": pops[pid]["count"], "status": pops[pid]["status"]} for pid in sorted(pops)
        },
        "governance": dict(FIXED_GOVERNANCE),
        "prohibited_for_training": True,
        "runtime_conformance_is_language_quality": False,
    }
