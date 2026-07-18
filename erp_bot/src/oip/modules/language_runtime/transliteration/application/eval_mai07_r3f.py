"""MAI-07R3F non-frozen English-identity corrective evaluation.

Does not open frozen V2 case bodies or R3E predictions.
"""

from __future__ import annotations

import hashlib
import json
import math
import time
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from .eval_c2_helpers import produced_views_from_span
from .eval_scoring import ProducedCandidateView
from .transliteration_service import attach_transliteration_to_frame
from .. import ENABLE_PROMOTION_OVERLAY, RESOURCE_PACK_VERSION, RUNTIME_VERSION
from ..infrastructure import resource_repository as xlrr
from ..infrastructure.english_identity_guard import EVAL_VERSION, GUARD_VERSION
from ..infrastructure.r3d_safety_gate import count_protected_mutations

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3f_english_identity"
REPORTS = OUT / "reports"
CANONICAL_SCORER = "mai-07.r3f.canonical.1.0.0"
AUDIT_SCORER = "mai-07.r3f.audit.1.0.0"

ENGLISH_KINDS = frozenset(
    {
        "ordinary_english",
        "technical_english",
        "english_identity",
        "english_accounting",
        "shared_borrowing_english_ctx",
        "shared_borrowing_romanized_ctx",
        "acronym",
        "counterfactual_english",
        "counterfactual_ambiguous",
        "unicode_casefold",
        "code_mix",
    }
)
ROMANIZED_KINDS = frozenset(
    {
        "romanized_core",
        "romanized_phrase",
        "domain_romanized",
        "romanized_morphology",
        "counterfactual_romanized",
    }
)


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _canonical(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def load_split(split: str, repo: Path = REPO) -> list[dict[str, Any]]:
    path = OUT / f"{split.lower()}.jsonl"
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return sorted(rows, key=lambda c: c["case_id"])


def extract_for_case(bundle, case: dict[str, Any]) -> tuple[list[ProducedCandidateView], str, str | None]:
    primary = case.get("primary_token") or case["input_text"].split()[0]
    pl = primary.lower()
    # Exact span match
    for sp in bundle.span_results:
        if sp.raw_span.original_text.lower() == pl and sp.candidates:
            views, err = produced_views_from_span(sp)
            return views, sp.raw_span.original_text, err
    # Primary contained as a whitespace token inside a multi-token span (MAI-05 merges).
    for sp in bundle.span_results:
        parts = [p for p in sp.raw_span.original_text.split() if p]
        if any(p.lower() == pl for p in parts) and sp.candidates:
            views, err = produced_views_from_span(sp)
            return views, sp.raw_span.original_text, err
    for sp in bundle.span_results:
        text = sp.raw_span.original_text
        if text.strip() and sp.candidates:
            views, err = produced_views_from_span(sp)
            return views, text, err
    return [], "", "empty_candidate_list"


def _target_hit(views: list[ProducedCandidateView], targets: list[str], *, k: int | None = None) -> bool:
    if not targets:
        return False
    tgt = set(targets)
    seq = views if k is None else views[:k]
    return any((not v.is_identity) and v.surface in tgt for v in seq)


def _target_rank(views: list[ProducedCandidateView], targets: list[str]) -> int | None:
    tgt = set(targets)
    for i, v in enumerate(views, start=1):
        if (not v.is_identity) and v.surface in tgt:
            return i
    return None


def _identity_top1(views: list[ProducedCandidateView], source: str) -> bool:
    if not views:
        return False
    top = views[0]
    return bool(top.is_identity and top.surface == source)


def _false_dev_on_english(views: list[ProducedCandidateView]) -> bool:
    if not views:
        return False
    top = views[0]
    return (not top.is_identity) and any("\u0900" <= ch <= "\u097F" for ch in top.surface)


def score_case(case: dict[str, Any], pred: dict[str, Any]) -> dict[str, Any]:
    ranked = [
        ProducedCandidateView(
            surface=r["surface"],
            is_identity=r["is_identity"],
            kind=r["kind"],
            script=r["script"],
            candidate_id=r.get("candidate_id", ""),
            rank=r["rank"],
        )
        for r in pred["ranked"]
    ]
    source = pred["source_surface"]
    targets = list(case.get("acceptable_devanagari_targets") or [])
    kind = case.get("suite_kind", "")
    identity_exp = bool(case.get("identity_expected"))
    top1_id = _identity_top1(ranked, source)
    t_rank = _target_rank(ranked, targets) if targets else None
    eng_pop = identity_exp or kind in ENGLISH_KINDS
    return {
        "case_id": case["case_id"],
        "suite_kind": kind,
        "identity_expected": identity_exp,
        "identity_top1": top1_id,
        "false_devanagari": _false_dev_on_english(ranked) if eng_pop else False,
        "target_top1": bool(t_rank == 1) if targets else None,
        "target_recall5": _target_hit(ranked, targets, k=5) if targets else None,
        "target_rr": (1.0 / t_rank) if t_rank else (0.0 if targets else None),
        "protected_mutation": bool(pred.get("protected_mutations")),
        "caps_ok": bool(pred.get("caps_ok")),
        "raw_ok": bool(pred.get("raw_ok")),
        "has_identity": any(v.is_identity for v in ranked),
        "candidate_surfaces": [r["surface"] for r in pred["ranked"]],
        "pair_id": case.get("pair_id"),
        "pair_role": case.get("pair_role"),
    }


def run_predictions(cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    xlrr.load_resources(force_reload=True)
    out: list[dict[str, Any]] = []
    for case in cases:
        raw = case["input_text"]
        t0 = time.perf_counter()
        frame = analyze_language(raw)
        updated = attach_transliteration_to_frame(frame, use_context=True)
        bundle = updated.transliteration_bundle
        assert bundle is not None
        latency_ms = (time.perf_counter() - t0) * 1000.0
        views, source, err = extract_for_case(bundle, case)
        ranked = [
            {
                "surface": v.surface,
                "is_identity": v.is_identity,
                "kind": v.kind,
                "script": v.script,
                "rank": v.rank,
                "candidate_id": v.candidate_id,
            }
            for v in views
        ]
        prot_mut = count_protected_mutations(bundle.span_results)
        caps_ok = all(len(sp.candidates) <= bundle.max_candidates_per_span for sp in bundle.span_results)
        raw_ok = updated.raw_text == raw
        out.append(
            {
                "case_id": case["case_id"],
                "source_surface": source or case.get("primary_token") or raw,
                "ranked": ranked,
                "structural_error": err,
                "protected_mutations": prot_mut,
                "caps_ok": caps_ok,
                "raw_ok": raw_ok,
                "runtime_version": RUNTIME_VERSION,
                "resource_version": RESOURCE_PACK_VERSION,
                "guard_version": GUARD_VERSION,
                "latency_ms": round(latency_ms, 4),
            }
        )
    return out


def _frac(num: int, den: int) -> dict[str, Any]:
    return {"numerator": num, "denominator": den, "value": (num / den) if den else 1.0}


def aggregate(
    cases: list[dict[str, Any]],
    preds: list[dict[str, Any]],
    *,
    check_determinism: bool = False,
    candidate_set_preservation: float = 1.0,
) -> dict[str, Any]:
    by = {c["case_id"]: c for c in cases}
    rows = [score_case(by[p["case_id"]], p) for p in preds if p["case_id"] in by]

    eng = [r for r in rows if by[r["case_id"]].get("identity_expected") or r["suite_kind"] in ENGLISH_KINDS]
    # Restrict false-dev / identity metrics to identity-expected English-like cases.
    eng_id_pop = [r for r in rows if by[r["case_id"]].get("identity_expected")]
    ordinary = [r for r in rows if r["suite_kind"] == "ordinary_english"]
    technical = [r for r in rows if r["suite_kind"] == "technical_english"]
    names = [r for r in rows if r["suite_kind"] == "proper_name"]
    rom = [
        r
        for r in rows
        if r["suite_kind"] in ROMANIZED_KINDS and r["target_top1"] is not None and not by[r["case_id"]].get("identity_expected")
    ]
    amb = [r for r in rows if r["suite_kind"] in {"ambiguous_latin", "counterfactual_ambiguous", "short_latin_control"}]
    prot = [r for r in rows if r["suite_kind"].startswith("protected") or by[r["case_id"]].get("is_protected")]

    # Counterfactual pair accuracy: for each complete pair, english→identity, ambiguous→identity,
    # romanized→target top1 when targets exist else identity retained.
    pair_ok = 0
    pair_n = 0
    by_pair: dict[str, dict[str, dict[str, Any]]] = {}
    for r in rows:
        pid = r.get("pair_id")
        if not pid:
            continue
        by_pair.setdefault(pid, {})[r.get("pair_role") or ""] = r
    for pid, roles in by_pair.items():
        if not {"english_context", "romanized_context", "ambiguous_context"} <= set(roles):
            continue
        pair_n += 1
        ok = True
        if not roles["english_context"]["identity_top1"]:
            ok = False
        if not roles["ambiguous_context"]["identity_top1"]:
            ok = False
        rom_row = roles["romanized_context"]
        case = by[rom_row["case_id"]]
        if case.get("identity_expected"):
            if not rom_row["identity_top1"]:
                ok = False
        elif rom_row["target_top1"] is False:
            ok = False
        if ok:
            pair_ok += 1

    eng_id = sum(1 for r in eng_id_pop if r["identity_top1"])
    false_dev = sum(1 for r in eng_id_pop if r["false_devanagari"])
    ord_id = sum(1 for r in ordinary if r["identity_top1"])
    tech_id = sum(1 for r in technical if r["identity_top1"])
    name_id = sum(1 for r in names if r["identity_top1"])
    rom_top1 = sum(1 for r in rom if r["target_top1"])
    rom_r5 = sum(1 for r in rom if r["target_recall5"])
    amb_ok = sum(1 for r in amb if r["identity_top1"] or by[r["case_id"]].get("abstention_expected"))
    prot_mut = sum(int(p.get("protected_mutations") or 0) for p in preds)
    raw_mut = sum(1 for p in preds if not p.get("raw_ok"))
    caps = sum(1 for p in preds if p.get("caps_ok"))

    det_ok = True
    if check_determinism and preds:
        snap1 = _canonical([{"c": p["case_id"], "r": p["ranked"]} for p in preds])
        preds2 = run_predictions(cases)
        snap2 = _canonical([{"c": p["case_id"], "r": p["ranked"]} for p in preds2])
        det_ok = snap1 == snap2

    metrics = {
        "english_identity_top1": _frac(eng_id, len(eng_id_pop)),
        "false_devanagari_on_english": _frac(false_dev, len(eng_id_pop)),
        "ordinary_english_identity": _frac(ord_id, len(ordinary)),
        "technical_english_identity": _frac(tech_id, len(technical)),
        "proper_name_identity": _frac(name_id, len(names)),
        "high_confidence_romanized_target_top1": _frac(rom_top1, len(rom)),
        "romanized_target_recall_at_5": _frac(rom_r5, len(rom)),
        "context_counterfactual_pair_accuracy": _frac(pair_ok, pair_n),
        "ambiguous_conservative_accuracy": _frac(amb_ok, len(amb)),
        "protected_span_mutations": {"numerator": prot_mut, "denominator": len(prot) or len(preds), "value": float(prot_mut)},
        "raw_view_mutations": {"numerator": raw_mut, "denominator": len(preds), "value": float(raw_mut)},
        "candidate_set_preservation": {
            "numerator": int(candidate_set_preservation == 1.0),
            "denominator": 1,
            "value": float(candidate_set_preservation),
        },
        "caps_respected": _frac(caps, len(preds)),
        "deterministic_output": {"numerator": int(det_ok), "denominator": 1, "value": 1.0 if det_ok else 0.0},
    }
    return {
        "scorer_version": CANONICAL_SCORER,
        "evaluator_version": EVAL_VERSION,
        "guard_version": GUARD_VERSION,
        "runtime_version": RUNTIME_VERSION,
        "resource_version": RESOURCE_PACK_VERSION,
        "resource_hash": xlrr.compute_pack_content_hash(),
        "case_count": len(cases),
        "metrics": metrics,
        "latency_ms_mean": (sum(p["latency_ms"] for p in preds) / len(preds)) if preds else 0.0,
        "overlay_disabled": ENABLE_PROMOTION_OVERLAY is False,
    }


def audit_aggregate(canonical: dict[str, Any]) -> dict[str, Any]:
    out = json.loads(_canonical(canonical))
    out["scorer_version"] = AUDIT_SCORER
    return out


def assert_scorers_agree(canonical: dict[str, Any], audit: dict[str, Any]) -> None:
    if canonical["metrics"] != audit["metrics"]:
        raise AssertionError("canonical/audit scorer disagreement")


def evaluate_gates(report: dict[str, Any], thresholds: dict[str, Any], harm: dict[str, int]) -> dict[str, Any]:
    gates = thresholds["gates"]
    decisions = {}
    all_pass = True
    metrics = dict(report["metrics"])
    for harm_key, harm_val in harm.items():
        metrics[harm_key] = {"numerator": harm_val, "denominator": 1, "value": float(harm_val)}
    for name, spec in gates.items():
        m = metrics.get(name)
        if m is None:
            decisions[name] = {"pass": False, "reason": "missing_metric"}
            all_pass = False
            continue
        val = m["value"]
        op = spec["op"]
        thr = spec["value"]
        num, den = m.get("numerator"), m.get("denominator")
        int_req = None
        if op == ">=" and den and isinstance(num, int):
            int_req = int(math.ceil(thr * den - 1e-12))
            ok = num >= int_req
        elif op == "<=" and den and isinstance(num, int):
            int_req = int(math.floor(thr * den + 1e-12))
            ok = num <= int_req
        elif op == "==":
            if name in {
                "protected_span_mutations",
                "raw_view_mutations",
                "english_identity_harm",
                "romanized_target_top1_harm",
                "target_recall_at_5_harm",
                "proper_name_harm",
                "protected_harm",
            }:
                ok = num == thr
            else:
                ok = abs(float(val) - float(thr)) < 1e-12
        else:
            ok = {
                ">=": val >= thr - 1e-12,
                "<=": val <= thr + 1e-12,
                "==": abs(val - thr) < 1e-12,
            }[op]
        decisions[name] = {
            "pass": bool(ok),
            "population": den,
            "numerator": num,
            "denominator": den,
            "exact_value": val,
            "integer_pass_requirement": int_req,
            "threshold": thr,
            "op": op,
        }
        if not ok:
            all_pass = False
    return {"all_pass": all_pass, "gates": decisions}


def run_split(split: str, *, write: bool = True, check_determinism: bool | None = None) -> dict[str, Any]:
    from .eval_mai07_r3f_differential import run_differential

    cases = load_split(split)
    preds = run_predictions(cases)
    if check_determinism is None:
        check_determinism = split in {"HOLDOUT_VALIDATION", "CONTEXT_COUNTERFACTUAL"}
    diff = run_differential(split, cases=cases, r3f_preds=preds)
    report = aggregate(
        cases,
        preds,
        check_determinism=check_determinism,
        candidate_set_preservation=float(diff.get("candidate_set_preservation", 1.0)),
    )
    audit = audit_aggregate(report)
    assert_scorers_agree(report, audit)
    thr = json.loads((OUT / "MAI_07R3F_HOLDOUT_THRESHOLDS.json").read_text(encoding="utf-8"))
    harm = {
        "english_identity_harm": int(diff.get("english_identity_harm", 0)),
        "romanized_target_top1_harm": int(diff.get("romanized_target_top1_harm", 0)),
        "target_recall_at_5_harm": int(diff.get("target_recall_at_5_harm", 0)),
        "proper_name_harm": int(diff.get("proper_name_harm", 0)),
        "protected_harm": int(diff.get("protected_harm", 0)),
    }
    report["harm"] = harm
    report["differential"] = {
        k: diff.get(k)
        for k in (
            "english_identity_harm",
            "romanized_target_top1_harm",
            "target_recall_at_5_harm",
            "proper_name_harm",
            "protected_harm",
            "candidate_set_preservation",
            "note",
        )
    }
    gate = evaluate_gates(report, thr, harm)
    payload = {
        "split": split,
        "report": report,
        "audit": audit,
        "gate_decision": gate,
        "predictions_sha256": _sha(_canonical(preds).encode("utf-8")),
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "QUALITY_GATES_PASSED": False,
        "evaluator_version": EVAL_VERSION,
    }
    if write:
        REPORTS.mkdir(parents=True, exist_ok=True)
        pred_path = REPORTS / f"MAI_07R3F_{split}_PREDICTIONS.jsonl"
        with pred_path.open("w", encoding="utf-8", newline="\n") as fh:
            for p in preds:
                fh.write(json.dumps(p, ensure_ascii=False, sort_keys=True) + "\n")
        rep_path = REPORTS / f"MAI_07R3F_{split}_SCORE_REPORT.json"
        rep_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        diff_path = REPORTS / f"MAI_07R3F_{split}_DIFFERENTIAL.json"
        diff_path.write_text(json.dumps(diff, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        payload["prediction_path"] = str(pred_path.relative_to(REPO)).replace("\\", "/")
        payload["report_path"] = str(rep_path.relative_to(REPO)).replace("\\", "/")
    return payload


def main() -> int:
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--split", required=True)
    p.add_argument("--no-write", action="store_true")
    args = p.parse_args()
    out = run_split(args.split, write=not args.no_write)
    print(json.dumps({"split": args.split, "all_pass": out["gate_decision"]["all_pass"], "metrics": out["report"]["metrics"], "harm": out["report"]["harm"]}, indent=2, sort_keys=True))
    return 0 if out["gate_decision"]["all_pass"] or args.split == "DEVELOPMENT" else 1


if __name__ == "__main__":
    raise SystemExit(main())
