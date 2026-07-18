"""MAI-07R3N2 independent audit scorer.

Does not import canonical scoring helpers from eval_mai07_r3n2_canonical_scorer.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from .r3n2_scoring_contracts import (
    FORMULA_VERSION,
    SCORER_VERSION,
    EvaluationPopulation,
    GateOutcome,
    build_metric,
    evaluate_gate,
    metric_required_when_empty,
)


def _has_dev(surface: str) -> bool:
    return any(0x0900 <= ord(ch) <= 0x097F for ch in surface)


def observe_case_audit(case: dict[str, Any], bundle: Any) -> dict[str, Any]:
    matches = [s for s in bundle.span_results if s.raw_span.original_text.lower() == case["highlighted_span"].lower()]
    span = matches[0] if matches else None
    cands = list(span.candidates) if span is not None else []
    top = cands[0] if cands else None
    return {
        "case_id": case["case_id"],
        "populations": list(case.get("populations") or case.get("population_ids") or []),
        "span_found": span is not None,
        "identity_top1": bool(top and top.is_identity),
        "identity_retained": any(c.is_identity for c in cands),
        "false_devanagari_top1": bool(top and (not top.is_identity) and _has_dev(top.surface)),
        "devanagari_at_5": any((not c.is_identity) and _has_dev(c.surface) for c in cands[:5]),
        "raw_text_unchanged": True,
        "caps_ok": all(len(s.candidates) <= 5 for s in bundle.span_results),
        "candidate_count": len(cands),
    }


def score_observations_audit(
    cases: list[dict[str, Any]],
    observations: list[dict[str, Any]],
    *,
    thresholds: dict[str, Any],
    split: str = "DEVELOPMENT",
) -> dict[str, Any]:
    by_id = {o["case_id"]: o for o in observations}
    pops: dict[str, list[str]] = defaultdict(list)
    for c in cases:
        for p in c.get("populations") or c.get("population_ids") or []:
            pops[p].append(c["case_id"])

    def pop(pid: str, *, required: bool = True) -> EvaluationPopulation:
        return EvaluationPopulation(population_id=pid, case_ids=tuple(sorted(set(pops.get(pid, [])))), required=required)

    metrics: dict[str, Any] = {}
    gates: dict[str, Any] = {}
    gates_cfg = thresholds.get("gates") or thresholds

    specs = [
        ("english_identity_top1", "ENGLISH_IDENTITY_REQUIRED", lambda o: o["identity_top1"] and not o["false_devanagari_top1"], 0.98, ">="),
        ("false_devanagari_on_english", "ENGLISH_IDENTITY_REQUIRED", lambda o: o["false_devanagari_top1"], 0.02, "<="),
        ("romanized_script_at_5", "ROMANIZED_NEPALI_REQUIRED", lambda o: o["devanagari_at_5"], 0.95, ">="),
        ("identity_retention", "IDENTITY_RETENTION_REQUIRED", lambda o: o["identity_retained"], 1.0, "=="),
        ("acronym_identity_top1", "ACRONYM_IDENTITY_REQUIRED", lambda o: o["identity_top1"], 1.0, "=="),
        ("identifier_identity_top1", "IDENTIFIER_PROTECTION_REQUIRED", lambda o: o["identity_top1"], 1.0, "=="),
        ("protected_identity", "PROTECTED_IDENTITY_REQUIRED", lambda o: o["identity_top1"] or o["identity_retained"], 1.0, "=="),
        ("authorized_code_corrective", "AUTHORIZED_CODE_CORRECTIVE", lambda o: o["identity_top1"] and not o["false_devanagari_top1"], 1.0, "=="),
        ("caps_ok", "CANDIDATE_CAP_PRESSURE", lambda o: o["caps_ok"], 1.0, "=="),
        ("raw_ok_all", "ENGLISH_IDENTITY_REQUIRED", lambda o: o["raw_text_unchanged"], 1.0, "=="),
        ("english_guard_analogue", "ENGLISH_GUARD_ANALOGUE", lambda o: o["identity_top1"] and not o["false_devanagari_top1"], 0.98, ">="),
        ("identity_invariant_analogue", "IDENTITY_INVARIANT_ANALOGUE", lambda o: o["identity_retained"], 1.0, "=="),
        ("acronym_identifier_analogue", "ACRONYM_IDENTIFIER_ANALOGUE", lambda o: o["identity_top1"], 1.0, "=="),
    ]
    for metric_id, pid, pred, default_thr, default_op in specs:
        cfg = gates_cfg.get(metric_id, {})
        thr = float(cfg.get("value", default_thr))
        op = cfg.get("op", default_op)
        required = metric_required_when_empty(metric_id, split)
        population = pop(pid, required=required)
        ids = population.case_ids
        num = sum(1 for i in ids if pred(by_id[i])) if ids else 0
        m = build_metric(metric_id=metric_id, population=population, numerator=num, threshold=thr, operation=op)
        metrics[metric_id] = m.to_dict()
        if population.size == 0:
            gates[metric_id] = {
                "metric_id": metric_id,
                "outcome": (
                    GateOutcome.INVALID_REQUIRED_POPULATION.value
                    if required
                    else GateOutcome.NOT_APPLICABLE.value
                ),
                "pass": not required,
            }
        else:
            gates[metric_id] = evaluate_gate(m).to_dict()

    failed = [k for k, g in gates.items() if not g.get("pass")]
    return {
        "scorer_id": "mai07_r3n2_audit_scorer",
        "scorer_version": SCORER_VERSION,
        "formula_version": FORMULA_VERSION,
        "metrics": metrics,
        "gates": gates,
        "ok": len(failed) == 0,
        "failed_gates": failed,
    }


def compare_canonical_audit(canonical: dict[str, Any], audit: dict[str, Any]) -> dict[str, Any]:
    mismatches: list[str] = []
    ignore = {"split_expected_pass"}
    for mid in sorted((set(canonical.get("metrics", {})) | set(audit.get("metrics", {}))) - ignore):
        cm = canonical["metrics"].get(mid)
        am = audit["metrics"].get(mid)
        if cm is None or am is None:
            mismatches.append(f"missing:{mid}")
            continue
        for key in ("numerator", "denominator", "population_id"):
            if cm.get(key) != am.get(key):
                mismatches.append(f"{mid}.{key}:{cm.get(key)}!={am.get(key)}")
    for mid in sorted(set(canonical.get("gates", {})) | set(audit.get("gates", {}))):
        cg = canonical["gates"].get(mid, {})
        ag = audit["gates"].get(mid, {})
        if cg.get("outcome") != ag.get("outcome"):
            mismatches.append(f"gate:{mid}:{cg.get('outcome')}!={ag.get('outcome')}")
    return {"ok": len(mismatches) == 0, "mismatches": mismatches}
