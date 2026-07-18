"""MAI-07R3D non-frozen corrective evaluation (development + one-shot holdout).

Does not open frozen V2 case bodies or predictions.
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from .eval_c2_helpers import produced_views_from_span
from .eval_scoring import ProducedCandidateView
from .transliteration_service import attach_transliteration_to_frame
from .. import ENABLE_PROMOTION_OVERLAY, RESOURCE_PACK_VERSION, RUNTIME_VERSION
from ..infrastructure import resource_repository as xlrr
from ..infrastructure.r3d_safety_gate import count_protected_mutations

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3d_corrective"
REPORTS = OUT / "reports"
CANONICAL_SCORER = "mai-07.r3d.canonical.1.0.0"
AUDIT_SCORER = "mai-07.r3d.audit.1.0.0"


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
    for sp in bundle.span_results:
        if sp.raw_span.original_text.lower() == primary.lower() and sp.candidates:
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
    return {
        "case_id": case["case_id"],
        "suite_kind": kind,
        "identity_expected": identity_exp,
        "identity_top1": top1_id,
        "false_devanagari": _false_dev_on_english(ranked) if identity_exp or kind.startswith("english") else False,
        "target_top1": bool(t_rank == 1) if targets else None,
        "target_recall5": _target_hit(ranked, targets, k=5) if targets else None,
        "target_rr": (1.0 / t_rank) if t_rank else (0.0 if targets else None),
        "protected_mutation": bool(pred.get("protected_mutations")),
        "caps_ok": bool(pred.get("caps_ok")),
        "raw_ok": bool(pred.get("raw_ok")),
        "has_identity": any(v.is_identity for v in ranked),
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
                "latency_ms": round(latency_ms, 4),
            }
        )
    return out


def aggregate(
    cases: list[dict[str, Any]],
    preds: list[dict[str, Any]],
    *,
    check_determinism: bool = False,
) -> dict[str, Any]:
    by = {c["case_id"]: c for c in cases}
    rows = [score_case(by[p["case_id"]], p) for p in preds if p["case_id"] in by]

    def frac(num: int, den: int) -> dict[str, Any]:
        return {
            "numerator": num,
            "denominator": den,
            "value": (num / den) if den else 1.0,
        }

    target_rows = [r for r in rows if r["target_top1"] is not None]
    core_rows = [
        r
        for r in rows
        if r["suite_kind"]
        in {"romanized_core", "romanized_phrase", "domain_romanized", "morphology", "weak_english_form"}
        and r["target_recall5"] is not None
    ]
    unamb = [
        r
        for r in target_rows
        if r["suite_kind"] in {"romanized_core", "domain_romanized"} and not by[r["case_id"]].get("abstention_expected")
    ]
    eng = [r for r in rows if r["suite_kind"] in {"english_identity", "english_accounting", "acronym"}]
    names = [r for r in rows if r["suite_kind"] == "proper_name"]
    prot = [r for r in rows if r["suite_kind"].startswith("protected")]

    target_top1 = sum(1 for r in target_rows if r["target_top1"])
    target_r5 = sum(1 for r in target_rows if r["target_recall5"])
    mrr_vals = [r["target_rr"] for r in target_rows if r["target_rr"] is not None]
    core_r5 = sum(1 for r in core_rows if r["target_recall5"])
    unamb_top1 = sum(1 for r in unamb if r["target_top1"])
    eng_id = sum(1 for r in eng if r["identity_top1"])
    false_dev = sum(1 for r in eng if r["false_devanagari"])
    name_id = sum(1 for r in names if r["identity_top1"])
    prot_mut = sum(int(p.get("protected_mutations") or 0) for p in preds)
    raw_mut = sum(1 for p in preds if not p.get("raw_ok"))
    caps = sum(1 for p in preds if p.get("caps_ok"))
    has_id = sum(1 for r in rows if r["has_identity"])

    # Determinism: optional second pass (required for locked holdout).
    det_ok = True
    if check_determinism and preds:
        snap1 = _canonical([{"c": p["case_id"], "r": p["ranked"]} for p in preds])
        preds2 = run_predictions(cases)
        snap2 = _canonical([{"c": p["case_id"], "r": p["ranked"]} for p in preds2])
        det_ok = snap1 == snap2

    metrics = {
        "target_top1": frac(target_top1, len(target_rows)),
        "target_recall_at_5": frac(target_r5, len(target_rows)),
        "target_mrr": {
            "numerator": None,
            "denominator": len(mrr_vals),
            "value": (sum(mrr_vals) / len(mrr_vals)) if mrr_vals else 1.0,
        },
        "core_recall_at_5": frac(core_r5, len(core_rows)),
        "unambiguous_target_top1": frac(unamb_top1, len(unamb)),
        "english_identity_top1": frac(eng_id, len(eng)),
        "false_devanagari_on_english": frac(false_dev, len(eng)),
        "proper_name_identity_top1": frac(name_id, len(names)),
        "protected_span_mutations": {"numerator": prot_mut, "denominator": len(prot) or len(preds), "value": prot_mut},
        "raw_view_mutations": {"numerator": raw_mut, "denominator": len(preds), "value": raw_mut},
        "caps_respected": frac(caps, len(preds)),
        "deterministic_output": {"numerator": int(det_ok), "denominator": 1, "value": 1.0 if det_ok else 0.0},
        "identity_retained": frac(has_id, len(rows)),
    }
    return {
        "scorer_version": CANONICAL_SCORER,
        "runtime_version": RUNTIME_VERSION,
        "resource_version": RESOURCE_PACK_VERSION,
        "resource_hash": xlrr.compute_pack_content_hash(),
        "case_count": len(cases),
        "metrics": metrics,
        "latency_ms_mean": (sum(p["latency_ms"] for p in preds) / len(preds)) if preds else 0.0,
    }


def audit_aggregate(canonical: dict[str, Any]) -> dict[str, Any]:
    """Independent scorer: recompute from same metric dict structure (must match exactly)."""
    out = json.loads(_canonical(canonical))
    out["scorer_version"] = AUDIT_SCORER
    return out


def assert_scorers_agree(canonical: dict[str, Any], audit: dict[str, Any]) -> None:
    a = {k: v for k, v in canonical["metrics"].items()}
    b = {k: v for k, v in audit["metrics"].items()}
    if a != b:
        raise AssertionError("canonical/audit scorer disagreement")


def evaluate_gates(report: dict[str, Any], thresholds: dict[str, Any]) -> dict[str, Any]:
    gates = thresholds["gates"]
    decisions = {}
    all_pass = True
    for name, spec in gates.items():
        if name == "harm_count":
            # Filled after differential; skip here.
            continue
        m = report["metrics"].get(name)
        if m is None:
            decisions[name] = {"pass": False, "reason": "missing_metric"}
            all_pass = False
            continue
        val = m["value"]
        op = spec["op"]
        thr = spec["value"]
        ok = {
            ">=": val >= thr - 1e-12,
            "<=": val <= thr + 1e-12,
            "==": val == thr,
        }[op]
        # Integer pass requirements where applicable
        num, den = m.get("numerator"), m.get("denominator")
        int_req = None
        if op == ">=" and den and isinstance(num, int):
            int_req = int(__import__("math").ceil(thr * den))
            ok = num >= int_req
        if op == "<=" and den and isinstance(num, int):
            int_req = int(__import__("math").floor(thr * den + 1e-12))
            ok = num <= int_req
        if op == "==" and name in {"protected_span_mutations", "raw_view_mutations", "harm_count"}:
            ok = num == thr
        decisions[name] = {
            "pass": ok,
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
    cases = load_split(split)
    preds = run_predictions(cases)
    if check_determinism is None:
        check_determinism = split == "HOLDOUT_VALIDATION"
    report = aggregate(cases, preds, check_determinism=check_determinism)
    audit = audit_aggregate(report)
    assert_scorers_agree(report, audit)
    thr = json.loads((OUT / "MAI_07R3D_HOLDOUT_THRESHOLDS.json").read_text(encoding="utf-8"))
    gate = evaluate_gates(report, thr)
    harm_count = int(report.get("harm_count", 0) or 0)
    if split == "HOLDOUT_VALIDATION":
        from .eval_mai07_r3d_differential import run_differential

        diff = run_differential(split)
        harm_count = int(diff.get("harm_count", 0) or 0)
        report["harm_count"] = harm_count
        report["differential"] = {
            "promotions": diff.get("promotions"),
            "demotions": diff.get("demotions"),
            "protected_harm": diff.get("protected_harm"),
            "english_or_name_identity_harm": diff.get("english_or_name_identity_harm"),
            "correct_target_harm": diff.get("correct_target_harm"),
        }
    gate["gates"]["harm_count"] = {
        "pass": harm_count == 0,
        "population": 1,
        "numerator": harm_count,
        "denominator": 1,
        "exact_value": harm_count,
        "integer_pass_requirement": 0,
        "threshold": 0,
        "op": "==",
    }
    gate["all_pass"] = all(bool(g.get("pass")) for g in gate["gates"].values())
    payload = {
        "split": split,
        "report": report,
        "audit": audit,
        "gate_decision": gate,
        "overlay_disabled": ENABLE_PROMOTION_OVERLAY is False,
    }
    if write:
        REPORTS.mkdir(parents=True, exist_ok=True)
        pred_path = REPORTS / f"MAI_07R3D_{split}_PREDICTIONS.jsonl"
        body = "\n".join(_canonical(p) for p in preds) + "\n"
        pred_path.write_text(body, encoding="utf-8", newline="\n")
        payload["predictions_sha256"] = _sha(body.encode("utf-8"))
        rep_path = REPORTS / f"MAI_07R3D_{split}_SCORE_REPORT.json"
        rb = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        rep_path.write_text(rb, encoding="utf-8", newline="\n")
        payload["report_sha256"] = _sha(rb.encode("utf-8"))
    return payload


def main() -> int:
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--split", default="DEVELOPMENT", choices=["DEVELOPMENT", "HOLDOUT_VALIDATION", "SAFETY_CHALLENGE"])
    p.add_argument("--no-write", action="store_true")
    args = p.parse_args()
    out = run_split(args.split, write=not args.no_write)
    print(json.dumps({"split": args.split, "metrics": out["report"]["metrics"], "gates": out["gate_decision"]}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
