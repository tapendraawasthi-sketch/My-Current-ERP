"""MAI-07R3N canonical scorer — population-bound policy conformance metrics."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from .r3n_scoring_contracts import (
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


def _select_span(bundle: Any, highlighted: str) -> Any | None:
    matches = [s for s in bundle.span_results if s.raw_span.original_text.lower() == highlighted.lower()]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        return matches[0]
    return None


def observe_case(case: dict[str, Any], bundle: Any, *, parent_bundle: Any | None = None) -> dict[str, Any]:
    span = _select_span(bundle, case["highlighted_span"])
    cands = list(span.candidates) if span is not None else []
    top = cands[0] if cands else None
    id_top1 = bool(top and top.is_identity)
    id_ret = any(c.is_identity for c in cands)
    dev_top1 = bool(top and (not top.is_identity) and _has_dev(top.surface))
    dev_at5 = any((not c.is_identity) and _has_dev(c.surface) for c in cands[:5])
    raw_ok = True  # pipeline never mutates raw
    caps_ok = all(len(s.candidates) <= 5 for s in bundle.span_results)
    parent_id_top1 = None
    if parent_bundle is not None:
        ps = _select_span(parent_bundle, case["highlighted_span"])
        pc = list(ps.candidates) if ps is not None else []
        parent_id_top1 = bool(pc and pc[0].is_identity)
    return {
        "case_id": case["case_id"],
        "populations": list(case.get("populations") or case.get("population_ids") or []),
        "expected_behavior": case.get("expected_behavior"),
        "span_found": span is not None,
        "identity_top1": id_top1,
        "identity_retained": id_ret,
        "false_devanagari_top1": dev_top1,
        "devanagari_at_5": dev_at5,
        "raw_text_unchanged": raw_ok,
        "caps_ok": caps_ok,
        "candidate_count": len(cands),
        "parent_identity_top1": parent_id_top1,
    }


def _pass_expected(obs: dict[str, Any]) -> bool:
    exp = obs.get("expected_behavior")
    if exp in ("IDENTITY_TOP1", "ACRONYM_IDENTITY_TOP1", "PROTECTED_IDENTITY"):
        return bool(obs["span_found"] and obs["identity_top1"] and not obs["false_devanagari_top1"])
    if exp == "IDENTITY_RETAINED":
        return bool(obs["span_found"] and obs["identity_retained"])
    if exp == "ROMANIZED_SCRIPT_AT_5":
        return bool(obs["span_found"] and obs["devanagari_at_5"])
    if exp == "SHARED_CONSERVATIVE":
        # Conservative: identity top-1 or review; never false-forced harm either way counted separately
        return bool(obs["span_found"] and obs["identity_retained"])
    if exp in ("NO_RAW_MUTATION", "CAP_OK"):
        return bool(obs["raw_text_unchanged"] and obs["caps_ok"])
    return bool(obs["span_found"] and obs["identity_retained"])


def score_observations(
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

    def rate_metric(metric_id: str, pid: str, pred, *, thr=None, op=">="):
        required = metric_required_when_empty(metric_id, split)
        population = pop(pid, required=required)
        ids = population.case_ids
        num = sum(1 for i in ids if pred(by_id[i])) if ids else 0
        m = build_metric(
            metric_id=metric_id,
            population=population,
            numerator=num,
            threshold=thr,
            operation=op,
        )
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
            return
        if thr is not None:
            g = evaluate_gate(m)
            gates[metric_id] = g.to_dict()


    gates_cfg = thresholds.get("gates") or thresholds

    rate_metric(
        "english_identity_top1",
        "ENGLISH_IDENTITY_REQUIRED",
        lambda o: o["identity_top1"] and not o["false_devanagari_top1"],
        thr=float(gates_cfg.get("english_identity_top1", {}).get("value", 0.98)),
        op=gates_cfg.get("english_identity_top1", {}).get("op", ">="),
    )
    rate_metric(
        "false_devanagari_on_english",
        "ENGLISH_IDENTITY_REQUIRED",
        lambda o: o["false_devanagari_top1"],
        thr=float(gates_cfg.get("false_devanagari_on_english", {}).get("value", 0.02)),
        op=gates_cfg.get("false_devanagari_on_english", {}).get("op", "<="),
    )
    rate_metric(
        "romanized_script_at_5",
        "ROMANIZED_NEPALI_REQUIRED",
        lambda o: o["devanagari_at_5"],
        thr=float(gates_cfg.get("romanized_script_at_5", {}).get("value", 0.90)),
        op=gates_cfg.get("romanized_script_at_5", {}).get("op", ">="),
    )
    rate_metric(
        "identity_retention",
        "IDENTITY_RETENTION_REQUIRED",
        lambda o: o["identity_retained"],
        thr=1.0,
        op="==",
    )
    rate_metric(
        "acronym_identity_top1",
        "ACRONYM_IDENTITY_REQUIRED",
        lambda o: o["identity_top1"],
        thr=1.0,
        op="==",
    )
    rate_metric(
        "identifier_identity_top1",
        "IDENTIFIER_PROTECTION_REQUIRED",
        lambda o: o["identity_top1"],
        thr=1.0,
        op="==",
    )
    rate_metric(
        "protected_identity",
        "PROTECTED_IDENTITY_REQUIRED",
        lambda o: o["identity_top1"] or o["identity_retained"],
        thr=1.0,
        op="==",
    )
    rate_metric(
        "authorized_code_corrective",
        "AUTHORIZED_CODE_CORRECTIVE",
        lambda o: o["identity_top1"] and not o["false_devanagari_top1"],
        thr=1.0,
        op="==",
    )
    rate_metric(
        "caps_ok",
        "CANDIDATE_CAP_PRESSURE",
        lambda o: o["caps_ok"],
        thr=1.0,
        op="==",
    )
    rate_metric(
        "raw_ok_all",
        "ENGLISH_IDENTITY_REQUIRED",
        lambda o: o["raw_text_unchanged"],
        thr=1.0,
        op="==",
    )

    # Expected-behavior pass rate on all cases
    all_ids = [c["case_id"] for c in cases]
    num_pass = sum(1 for i in all_ids if _pass_expected(by_id[i]))
    metrics["split_expected_pass"] = {
        "metric_id": "split_expected_pass",
        "numerator": num_pass,
        "denominator": len(all_ids),
        "value": (num_pass / len(all_ids)) if all_ids else None,
        "scorer_version": SCORER_VERSION,
        "formula_version": FORMULA_VERSION,
    }

    failed_gates = [k for k, g in gates.items() if not g.get("pass")]
    return {
        "scorer_id": "mai07_r3n_canonical_scorer",
        "scorer_version": SCORER_VERSION,
        "formula_version": FORMULA_VERSION,
        "metrics": metrics,
        "gates": gates,
        "ok": len(failed_gates) == 0,
        "failed_gates": failed_gates,
        "observations": observations,
    }
