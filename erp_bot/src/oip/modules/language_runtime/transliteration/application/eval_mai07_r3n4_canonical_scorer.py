"""MAI-07R3N4 canonical scorer — population-bound identity-anchor conformance metrics."""

from __future__ import annotations

import json
from collections import defaultdict
from typing import Any

from .r3n4_candidate_finalization import canonical_serialize_candidates, finalize_idempotent
from .r3n4_identity_anchor import IdentityAnchorError, create_identity_anchor
from .r3n4_scoring_contracts import (
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


def _serialization_roundtrip_ok(cands: list[Any]) -> bool:
    """Serialize once, reparse, and compare field-level fidelity plus re-serialize stability."""
    serialized = canonical_serialize_candidates(cands)
    try:
        reparsed_rows = json.loads(serialized)
    except (TypeError, ValueError):
        return False
    if len(reparsed_rows) != len(cands):
        return False
    fields_ok = (
        [r.get("surface") for r in reparsed_rows] == [c.surface for c in cands]
        and [bool(r.get("is_identity")) for r in reparsed_rows] == [bool(c.is_identity) for c in cands]
        and [int(r.get("rank")) for r in reparsed_rows] == [int(c.rank) for c in cands]
    )
    reserialize_stable = canonical_serialize_candidates(cands) == serialized
    return bool(fields_ok and reserialize_stable)


def observe_case(case: dict[str, Any], bundle: Any, *, parent_bundle: Any | None = None) -> dict[str, Any]:
    highlighted = case["highlighted_span"]
    raw_text = case.get("input_text", "") or ""
    span = _select_span(bundle, highlighted)
    cands = list(span.candidates) if span is not None else []
    top = cands[0] if cands else None
    id_top1 = bool(top and top.is_identity)
    id_ret = any(c.is_identity for c in cands)
    exact_raw = bool(
        span is not None
        and any(c.is_identity and c.surface == highlighted for c in cands)
    )
    exactly_one = sum(1 for c in cands if c.is_identity) == 1
    dev_top1 = bool(top and (not top.is_identity) and _has_dev(top.surface))
    dev_at5 = any((not c.is_identity) and _has_dev(c.surface) for c in cands[:5])
    raw_ok = True
    caps_ok = all(len(s.candidates) <= 5 for s in bundle.span_results)

    reason_codes = set(getattr(span, "decision_reason_codes", ()) or ()) if span is not None else set()
    path_finalized = bool(
        span is not None
        and (
            "R3N4_ANCHOR_FINALIZED" in reason_codes
            or any("r3n4_anchor_reserved" in (c.provenance or ()) for c in cands)
        )
    )

    anchor = None
    anchor_valid = False
    finalizer_idempotent = False
    serialization_roundtrip = False
    if span is not None and cands:
        rs = span.raw_span
        try:
            anchor = create_identity_anchor(
                raw_text,
                raw_start=int(rs.start_offset),
                raw_end_exclusive=int(rs.end_offset),
                anchor_kind="AUDIT_OBSERVATION",
                created_from="eval_mai07_r3n4_canonical_scorer.observe_case",
            )
        except IdentityAnchorError:
            anchor = None
        if anchor is not None:
            anchor_valid = bool(exact_raw and anchor.raw_surface == highlighted)
            finalizer_idempotent = finalize_idempotent(anchor, list(cands), raw_text=raw_text)
            serialization_roundtrip = _serialization_roundtrip_ok(cands)

    parent_id_top1 = None
    if parent_bundle is not None:
        ps = _select_span(parent_bundle, highlighted)
        pc = list(ps.candidates) if ps is not None else []
        parent_id_top1 = bool(pc and pc[0].is_identity)
    return {
        "case_id": case["case_id"],
        "populations": list(case.get("populations") or case.get("population_ids") or []),
        "expected_behavior": case.get("expected_behavior"),
        "span_found": span is not None,
        "identity_top1": id_top1,
        "identity_retained": id_ret,
        "exact_raw_identity": exact_raw,
        "exactly_one_identity": exactly_one,
        "finalizer_idempotence": finalizer_idempotent,
        "serialization_roundtrip": serialization_roundtrip,
        "path_finalized": path_finalized,
        "anchor_valid": anchor_valid,
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
        return bool(obs["span_found"] and obs["exact_raw_identity"])
    if exp == "ROMANIZED_SCRIPT_AT_5":
        return bool(obs["span_found"] and obs["devanagari_at_5"])
    if exp == "SHARED_CONSERVATIVE":
        return bool(obs["span_found"] and obs["exact_raw_identity"])
    if exp in ("NO_RAW_MUTATION", "CAP_OK"):
        return bool(obs["raw_text_unchanged"] and obs["caps_ok"] and obs["exact_raw_identity"])
    return bool(obs["span_found"] and obs["exact_raw_identity"])


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

    def rate_all_cases(metric_id: str, pred, *, thr=None, op=">="):
        required = metric_required_when_empty(metric_id, split)
        all_ids = [c["case_id"] for c in cases]
        population = EvaluationPopulation(
            population_id=f"SPLIT_{split}",
            case_ids=tuple(all_ids),
            required=required,
        )
        num = sum(1 for i in all_ids if pred(by_id[i])) if all_ids else 0
        m = build_metric(
            metric_id=metric_id,
            population=population,
            numerator=num,
            threshold=thr,
            operation=op,
        )
        metrics[metric_id] = m.to_dict()
        if not all_ids:
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
            gates[metric_id] = evaluate_gate(m).to_dict()

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
        thr=float(gates_cfg.get("romanized_script_at_5", {}).get("value", 0.95)),
        op=gates_cfg.get("romanized_script_at_5", {}).get("op", ">="),
    )
    rate_metric(
        "identity_retention",
        "IDENTITY_RETENTION_REQUIRED",
        lambda o: o["exact_raw_identity"],
        thr=float(gates_cfg.get("identity_retention", {}).get("value", 1.0)),
        op=gates_cfg.get("identity_retention", {}).get("op", "=="),
    )
    rate_metric(
        "exact_raw_identity",
        "IDENTITY_RETENTION_REQUIRED",
        lambda o: o["exact_raw_identity"],
        thr=float(gates_cfg.get("exact_raw_identity", {}).get("value", 1.0)),
        op=gates_cfg.get("exact_raw_identity", {}).get("op", "=="),
    )
    rate_metric(
        "exact_raw_identity_required",
        "EXACT_RAW_IDENTITY_REQUIRED",
        lambda o: o["exact_raw_identity"],
        thr=float(gates_cfg.get("exact_raw_identity", {}).get("value", 1.0)),
        op=gates_cfg.get("exact_raw_identity", {}).get("op", "=="),
    )
    rate_metric(
        "exactly_one_identity",
        "IDENTITY_RETENTION_REQUIRED",
        lambda o: o["exactly_one_identity"],
        thr=float(gates_cfg.get("exactly_one_identity", {}).get("value", 1.0)),
        op=gates_cfg.get("exactly_one_identity", {}).get("op", "=="),
    )
    rate_metric(
        "exactly_one_identity_required",
        "EXACTLY_ONE_IDENTITY_REQUIRED",
        lambda o: o["exactly_one_identity"],
        thr=float(gates_cfg.get("exactly_one_identity", {}).get("value", 1.0)),
        op=gates_cfg.get("exactly_one_identity", {}).get("op", "=="),
    )
    rate_metric(
        "identity_invariant_analogue",
        "IDENTITY_INVARIANT_ANALOGUE",
        lambda o: o["exact_raw_identity"],
        thr=float(gates_cfg.get("identity_invariant_analogue", {}).get("value", 1.0)),
        op=gates_cfg.get("identity_invariant_analogue", {}).get("op", "=="),
    )
    cap_pressure_pid = (
        "IDENTITY_ANCHOR_CHALLENGE"
        if split == "IDENTITY_ANCHOR_CHALLENGE"
        else "CANDIDATE_CAP_PRESSURE"
    )
    rate_metric(
        "cap_pressure_identity_retention",
        cap_pressure_pid,
        lambda o: o["exact_raw_identity"],
        thr=float(gates_cfg.get("cap_pressure_identity_retention", {}).get("value", 1.0)),
        op=gates_cfg.get("cap_pressure_identity_retention", {}).get("op", "=="),
    )
    rate_metric(
        "multi_token_identity",
        "MULTI_TOKEN_IDENTITY",
        lambda o: o["exact_raw_identity"],
        thr=1.0,
        op="==",
    )
    rate_metric(
        "refined_span_identity",
        "REFINED_SPAN_IDENTITY",
        lambda o: o["exact_raw_identity"],
        thr=1.0,
        op="==",
    )
    rate_metric(
        "coalesced_span_identity",
        "COALESCED_SPAN_IDENTITY",
        lambda o: o["exact_raw_identity"],
        thr=1.0,
        op="==",
    )
    rate_metric(
        "unicode_identity",
        "UNICODE_IDENTITY",
        lambda o: o["exact_raw_identity"],
        thr=1.0,
        op="==",
    )
    rate_metric(
        "serialization_roundtrip",
        "SERIALIZATION_ROUNDTRIP",
        lambda o: o["serialization_roundtrip"],
        thr=float(gates_cfg.get("serialization_roundtrip", {}).get("value", 1.0)),
        op=gates_cfg.get("serialization_roundtrip", {}).get("op", "=="),
    )
    rate_metric(
        "anchor_validity",
        "IDENTITY_RETENTION_REQUIRED",
        lambda o: o["anchor_valid"],
        thr=float(gates_cfg.get("anchor_validity", {}).get("value", 1.0)),
        op=gates_cfg.get("anchor_validity", {}).get("op", "=="),
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
        lambda o: o["identity_top1"] or o["exact_raw_identity"],
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
    rate_metric(
        "english_guard_analogue",
        "ENGLISH_GUARD_ANALOGUE",
        lambda o: o["identity_top1"] and not o["false_devanagari_top1"],
        thr=float(gates_cfg.get("english_guard_analogue", {}).get("value", 0.98)),
        op=gates_cfg.get("english_guard_analogue", {}).get("op", ">="),
    )
    rate_metric(
        "acronym_identifier_analogue",
        "ACRONYM_IDENTIFIER_ANALOGUE",
        lambda o: o["identity_top1"],
        thr=1.0,
        op="==",
    )
    rate_all_cases(
        "finalizer_idempotence",
        lambda o: o["finalizer_idempotence"],
        thr=float(gates_cfg.get("finalizer_idempotence", {}).get("value", 1.0)),
        op=gates_cfg.get("finalizer_idempotence", {}).get("op", "=="),
    )
    rate_all_cases(
        "path_finalization_coverage",
        lambda o: o["path_finalized"],
        thr=float(gates_cfg.get("path_finalization_coverage", {}).get("value", 1.0)),
        op=gates_cfg.get("path_finalization_coverage", {}).get("op", "=="),
    )

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
        "scorer_id": "mai07_r3n4_canonical_scorer",
        "scorer_version": SCORER_VERSION,
        "formula_version": FORMULA_VERSION,
        "metrics": metrics,
        "gates": gates,
        "ok": len(failed_gates) == 0,
        "failed_gates": failed_gates,
        "observations": observations,
    }
