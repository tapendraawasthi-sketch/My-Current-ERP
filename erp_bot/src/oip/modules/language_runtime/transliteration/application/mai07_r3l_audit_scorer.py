"""MAI-07R3L independent audit scorer.

Clean-room reimplementation. MUST NOT import mai07_r3l_canonical_scorer.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

# Intentionally do not import mai07_r3l_canonical_scorer.

PHASE = "MAI-07R3L-AI-ASSISTED-RUNTIME-CONFORMANCE-DIAGNOSTIC"
SCHEMA_VERSION = "mai07_r3l_runtime_conformance_diagnostic_v1"
AUDIT_SCORER_ID = "mai07_r3l_audit_scorer"


def _rate(n: int, d: int) -> float | None:
    if d == 0:
        return None
    return float(n) / float(d)


def _metric(metric_id: str, population_id: str, num_ids: list[str], den_ids: list[str]) -> dict[str, Any]:
    n, d = len(num_ids), len(den_ids)
    return {
        "metric_id": metric_id,
        "population_id": population_id,
        "numerator": n,
        "denominator": d,
        "applicability": "SCORABLE" if d else "NOT_APPLICABLE",
        "case_ids_numerator": sorted(num_ids),
        "case_ids_denominator": sorted(den_ids),
        "rate": _rate(n, d),
    }


def score_audit(
    cases: list[dict[str, Any]],
    predictions: list[dict[str, Any]],
    results: list[dict[str, Any]],
    population_manifest: dict[str, Any],
) -> dict[str, Any]:
    pred_by = {p["source_item_id"]: p for p in predictions}
    res_by = {r["source_item_id"]: r for r in results}
    case_by = {c["source_item_id"]: c for c in cases}
    pops = population_manifest["populations"]

    def den_for(pop_id: str) -> list[str]:
        return list(pops[pop_id]["case_ids"])

    all_ids = den_for("ALL_CASES")
    raw_mut = [i for i in all_ids if pred_by[i]["raw_text_unchanged"] is False]
    prot_mut = [i for i in all_ids if pred_by[i]["protected_span_identity_ok"] is False]
    caps_ok = [i for i in all_ids if pred_by[i]["caps_ok"] is True]
    exceptions = [i for i in all_ids if pred_by[i].get("exception_status")]
    submitted = len(all_ids)

    safety = {
        "submitted": submitted,
        "completed": submitted - len(exceptions),
        "exceptions": len(exceptions),
        "raw_text_mutation_count": len(raw_mut),
        "protected_span_mutation_count": len(prot_mut),
        "identifier_acronym_mutation_count": len(
            [
                i
                for i in all_ids
                if case_by[i]["behavior"]["behavior_class"] in ("ACRONYM", "PROTECTED_OR_IDENTIFIER")
                and (
                    pred_by[i]["identity_top1"] is False or pred_by[i]["raw_text_unchanged"] is False
                )
            ]
        ),
        "candidate_cap_compliance_numerator": len(caps_ok),
        "candidate_cap_compliance_denominator": submitted,
        "candidate_cap_compliance_rate": _rate(len(caps_ok), submitted),
        "accounting_mutation_attempts": 0,
        "successful_mutations": 0,
        "execution_authority_fields_present": False,
        "critical_diagnostic_finding": bool(
            raw_mut or prot_mut or exceptions or len(caps_ok) != submitted
        ),
    }

    metrics: dict[str, Any] = {
        "safety_raw_mutations": _metric("safety_raw_mutations", "ALL_CASES", raw_mut, all_ids),
        "safety_protected_mutations": _metric(
            "safety_protected_mutations", "ALL_CASES", prot_mut, all_ids
        ),
        "caps_respected": _metric("caps_respected", "ALL_CASES", caps_ok, all_ids),
    }

    def scorable(pop_id: str, behavior: str) -> list[str]:
        out = []
        for i in den_for(pop_id):
            r = res_by[i]
            if r["scoring_applicability"] != "SCORABLE":
                continue
            if r["outcome"] in ("SPAN_FAILURE", "EXCEPTION", "UNSUPPORTED"):
                continue
            if r["behavior_class"] != behavior:
                continue
            out.append(i)
        return out

    eng = scorable("ENGLISH_IDENTITY", "ENGLISH_IDENTITY")
    metrics["identity_top1"] = _metric(
        "identity_top1", "ENGLISH_IDENTITY", [i for i in eng if pred_by[i]["identity_top1"]], eng
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

    dev = scorable("DEVANAGARI_BEHAVIOR", "DEVANAGARI_TRANSLITERATION")
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
            if ("ABSTAIN" in str(pred_by[i].get("eligibility") or "").upper())
            or bool(pred_by[i].get("review_required"))
        ],
        dev,
    )

    idfirst = scorable("IDENTITY_FIRST", "IDENTITY_FIRST")
    metrics["identity_first_top1"] = _metric(
        "identity_top1",
        "IDENTITY_FIRST",
        [i for i in idfirst if pred_by[i]["identity_top1"]],
        idfirst,
    )

    opt = scorable("OPTIONAL", "OPTIONAL")
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
            if pred_by[i]["devanagari_non_identity_top1"]
            and pred_by[i]["identity_retained_at_5"] is False
        ],
        opt,
    )

    acr = scorable("ACRONYM", "ACRONYM")
    metrics["acronym_identity_top1"] = _metric(
        "identity_top1", "ACRONYM", [i for i in acr if pred_by[i]["identity_top1"]], acr
    )

    for pop in ("ACCOUNTING_CONTENT_MAP", "HEURISTIC_V1", "R3K_RISK_QUEUE", "ALL_CASES"):
        den = [
            i
            for i in den_for(pop)
            if res_by[i]["scoring_applicability"] == "SCORABLE"
            and res_by[i]["outcome"] not in ("SPAN_FAILURE", "EXCEPTION", "UNSUPPORTED")
        ]
        metrics[f"pass_rate__{pop}"] = _metric(
            "pass_rate", pop, [i for i in den if res_by[i]["outcome"] == "PASS"], den
        )

    by_tier: dict[str, list[str]] = defaultdict(list)
    for c in cases:
        t = c.get("r3k_risk_tier")
        if t:
            by_tier[t].append(c["source_item_id"])
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

    outcome_counts: dict[str, int] = defaultdict(int)
    for r in results:
        outcome_counts[r["outcome"]] += 1

    return {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "scorer_id": AUDIT_SCORER_ID,
        "metrics": metrics,
        "safety": safety,
        "outcome_counts": dict(sorted(outcome_counts.items())),
        "population_statuses": {
            pid: {"count": pops[pid]["count"], "status": pops[pid]["status"]} for pid in sorted(pops)
        },
        "governance": {
            "independent_human_review": False,
            "linguist_approved": False,
            "production_approved": False,
            "quality_gates_passed": False,
            "majority_voting_is_gold": False,
            "agreement_is_independent_human_irr": False,
            "runtime_conformance_is_language_quality": False,
            "prohibited_for_training": True,
            "MAI-07": "NEEDS_CORRECTIVE_WORK",
            "MAI-08": "NOT_STARTED",
        },
        "prohibited_for_training": True,
        "runtime_conformance_is_language_quality": False,
    }


def compare_reports(canonical: dict[str, Any], audit: dict[str, Any]) -> dict[str, Any]:
    mismatches: list[str] = []

    def cmp_metric(key: str) -> None:
        a = canonical["metrics"].get(key)
        b = audit["metrics"].get(key)
        if a is None or b is None:
            mismatches.append(f"missing_metric:{key}")
            return
        for field in ("numerator", "denominator", "applicability", "population_id", "metric_id"):
            if a.get(field) != b.get(field):
                mismatches.append(f"{key}.{field}:{a.get(field)}!={b.get(field)}")
        if a.get("case_ids_numerator") != b.get("case_ids_numerator"):
            mismatches.append(f"{key}.case_ids_numerator")
        if a.get("case_ids_denominator") != b.get("case_ids_denominator"):
            mismatches.append(f"{key}.case_ids_denominator")

    keys = sorted(set(canonical["metrics"]) | set(audit["metrics"]))
    for k in keys:
        cmp_metric(k)

    for field in (
        "submitted",
        "completed",
        "exceptions",
        "raw_text_mutation_count",
        "protected_span_mutation_count",
        "candidate_cap_compliance_numerator",
        "candidate_cap_compliance_denominator",
        "accounting_mutation_attempts",
        "successful_mutations",
    ):
        if canonical["safety"].get(field) != audit["safety"].get(field):
            mismatches.append(f"safety.{field}")

    if canonical.get("outcome_counts") != audit.get("outcome_counts"):
        mismatches.append("outcome_counts")
    if canonical.get("population_statuses") != audit.get("population_statuses"):
        mismatches.append("population_statuses")

    return {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "ok": len(mismatches) == 0,
        "mismatch_count": len(mismatches),
        "mismatches": mismatches[:50],
        "prohibited_for_training": True,
    }
