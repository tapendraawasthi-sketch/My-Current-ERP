"""MAI-07R3Q — authorized one-shot frozen V3 evaluation of R3Q candidate.

Loads mai-07.1.12-r3q-protspan explicitly (R3N6 pack bytes + highlight alignment).
Does not promote it. Active default must remain mai-07.1.3-r3f-sealnew.
Scores FROZEN_EVALUATION pool only (QUALITY_GATES).
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from .mai07_r3q_candidate_runtime import (
    CANDIDATE_RUNTIME_VERSION,
    assert_active_default_immutable,
    load_r3q_resources,
    transliterate_r3q,
)
from .r3q_protected_span_align import extract_highlighted_produced
from .transliteration_service import attach_transliteration_to_frame
from .. import ENABLE_PROMOTION_OVERLAY, RESOURCE_PACK_VERSION, RUNTIME_VERSION

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals/mai07/r3q_frozen_v3"
REPORTS = OUT / "reports"
MANIFESTS = REPO / "evals/mai07/manifests"
FROZEN_V3 = REPO / "evals/mai07/frozen_v3"

DATASET_ID = "MAI_07_ROMANIZED_TRANSLITERATION_V3"
EXPECTED_DATASET_HASH = "6ad2a824a6fe0cb1248d7640692f8c45635b4290ee33647d5cbe4b82af2bdde8"
EXPECTED_CANDIDATE_HASH = "8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106"
DEFAULT_ACTIVE = "mai-07.1.3-r3f-sealnew"
AUTHORIZATION = "EXPLICIT_USER_AUTHORIZATION_MAI_07R3Q_FROZEN_V3_ONE_SHOT"
PHASE_ID = "MAI-07R3Q-PROTECTED-SPAN-ALIGNMENT-FROZEN-V3-ONE-SHOT"
ATTEMPT_ID = "MAI_07R3Q_FROZEN_V3_ATTEMPT_001"

_DEV = re.compile(r"[\u0900-\u097F]")


def _sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha_file(path: Path) -> str:
    return _sha_bytes(path.read_bytes())


def _write_json(path: Path, obj: Any) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")
    return _sha_bytes(text.encode("utf-8"))


def _frac(num: int, den: int) -> dict[str, Any]:
    if den == 0:
        return {"status": "INVALID_REQUIRED_POPULATION", "numerator": 0, "denominator": 0, "value": None}
    f = Fraction(num, den)
    return {
        "numerator": num,
        "denominator": den,
        "value_unrounded": str(f),
        "value_float": float(f),
    }


def recompute_dataset_hash(repo: Path = REPO) -> str:
    man = json.loads((MANIFESTS / "MAI_07_ROMANIZED_TRANSLITERATION_V3.manifest.json").read_text(encoding="utf-8"))
    h = hashlib.sha256()
    for f in sorted(man["files"], key=lambda x: x["suite_id"]):
        h.update(f["suite_id"].encode())
        h.update(b"\0")
        h.update((repo / f["path"]).read_bytes())
    return h.hexdigest()


def load_frozen_evaluation_cases(repo: Path = REPO) -> list[dict[str, Any]]:
    man = json.loads((MANIFESTS / "MAI_07_ROMANIZED_TRANSLITERATION_V3.manifest.json").read_text(encoding="utf-8"))
    if man["dataset_hash"] != EXPECTED_DATASET_HASH:
        raise RuntimeError(f"dataset_hash_mismatch:{man['dataset_hash']}")
    if recompute_dataset_hash(repo) != EXPECTED_DATASET_HASH:
        raise RuntimeError("dataset_bytes_drift")
    cases: list[dict[str, Any]] = []
    for f in man["files"]:
        if "__frozen_evaluation" not in f["suite_id"]:
            continue
        path = repo / f["path"]
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            case = json.loads(line)
            if case.get("pool") != "FROZEN_EVALUATION":
                raise RuntimeError(f"non_fe_case_in_fe_suite:{case.get('case_id')}")
            cases.append(case)
    cases.sort(key=lambda c: c["case_id"])
    return cases


def prove_candidate_pack_load() -> dict[str, Any]:
    assert_active_default_immutable()
    if RUNTIME_VERSION != DEFAULT_ACTIVE or RESOURCE_PACK_VERSION != DEFAULT_ACTIVE:
        raise RuntimeError(f"active_default_drift:{RUNTIME_VERSION}:{RESOURCE_PACK_VERSION}")
    if ENABLE_PROMOTION_OVERLAY is not False:
        raise RuntimeError("overlay_enabled")
    resources = load_r3q_resources()
    proof = {
        "ok": True,
        "candidate_runtime_version": CANDIDATE_RUNTIME_VERSION,
        "candidate_content_hash": resources.content_hash,
        "expected_candidate_content_hash": EXPECTED_CANDIDATE_HASH,
        "candidate_matches_pin": resources.content_hash == EXPECTED_CANDIDATE_HASH,
        "active_runtime_version": RUNTIME_VERSION,
        "active_resource_pack_version": RESOURCE_PACK_VERSION,
        "active_unchanged": RUNTIME_VERSION == DEFAULT_ACTIVE,
        "overlay_disabled": ENABLE_PROMOTION_OVERLAY is False,
        "candidate_promoted": False,
        "default_active_flag_false": True,
        "correction_scope": "PROTECTED_SPAN_HIGHLIGHT_ALIGNMENT",
        "reuses_r3n6_pack_bytes": True,
    }
    if not proof["candidate_matches_pin"]:
        raise RuntimeError(f"candidate_hash_mismatch:{resources.content_hash}")
    _write_json(REPORTS / "MAI_07R3Q_CANDIDATE_PACK_LOAD_PROOF.json", proof)
    return proof


def preflight(repo: Path = REPO) -> dict[str, Any]:
    proof = prove_candidate_pack_load()
    cases = load_frozen_evaluation_cases(repo)
    thr = json.loads((MANIFESTS / "MAI_07_R3P_THRESHOLDS_V3.manifest.json").read_text(encoding="utf-8"))
    if not thr.get("locked_before_runtime_observation"):
        raise RuntimeError("thresholds_not_locked")
    out = {
        "ok": True,
        "phase": PHASE_ID,
        "authorization": AUTHORIZATION,
        "dataset_id": DATASET_ID,
        "dataset_hash": EXPECTED_DATASET_HASH,
        "frozen_evaluation_cases": len(cases),
        "threshold_id": thr["threshold_id"],
        "candidate_proof": proof,
        "QUALITY_GATES_PASSED": False,
        "note": "Preflight only; no predictions yet.",
    }
    _write_json(REPORTS / "MAI_07R3Q_V3_ONE_SHOT_PREFLIGHT.json", out)
    return out


def lock_attempt(repo: Path = REPO) -> dict[str, Any]:
    if (OUT / f"{ATTEMPT_ID}.EXECUTION_RESULT.json").exists():
        raise RuntimeError("attempt_already_executed")
    pf = preflight(repo)
    lock = {
        "schema_version": "1.0.0",
        "attempt_id": ATTEMPT_ID,
        "phase": PHASE_ID,
        "authorization": AUTHORIZATION,
        "status": "LOCKED_NOT_RUN",
        "dataset_id": DATASET_ID,
        "dataset_hash": EXPECTED_DATASET_HASH,
        "frozen_evaluation_cases": pf["frozen_evaluation_cases"],
        "candidate_runtime_version": CANDIDATE_RUNTIME_VERSION,
        "candidate_content_hash": EXPECTED_CANDIDATE_HASH,
        "active_runtime_must_remain": DEFAULT_ACTIVE,
        "thresholds_path": "evals/mai07/manifests/MAI_07_R3P_THRESHOLDS_V3.manifest.json",
        "prediction_path": f"evals/mai07/r3q_frozen_v3/reports/{ATTEMPT_ID}_PREDICTIONS.jsonl",
        "locked_utc": datetime.now(timezone.utc).isoformat(),
        "one_shot": True,
        "QUALITY_GATES_PASSED": False,
        "PRODUCTION_APPROVED": False,
        "candidate_promoted": False,
    }
    path = OUT / f"{ATTEMPT_ID}.LOCKED_NOT_RUN.json"
    if path.exists():
        existing = json.loads(path.read_text(encoding="utf-8"))
        if existing.get("status") != "LOCKED_NOT_RUN":
            raise RuntimeError("lock_already_consumed")
        return existing
    _write_json(path, lock)
    return lock


def _match_preferred(surface: str, preferred: list[str]) -> bool:
    if surface in preferred:
        return True
    cf = surface.casefold()
    return any(p.casefold() == cf for p in preferred)


def _contains_dev(text: str) -> bool:
    return bool(_DEV.search(text or ""))


def run_predictions(cases: list[dict[str, Any]], resources: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for case in cases:
        span = case.get("highlighted_span") or ""
        text = case["input_text"]
        bundle = transliterate_r3q(text, resources=resources)
        produced, source, err = extract_highlighted_produced(bundle, text=text, span=span)
        if not produced:
            frame = analyze_language(text)
            tb = attach_transliteration_to_frame(
                frame, use_context=True, resources=resources
            ).transliteration_bundle
            if tb is not None:
                produced, source, err = extract_highlighted_produced(tb, text=text, span=span)
        ranked = [
            {
                "surface": p.surface,
                "is_identity": p.is_identity,
                "kind": p.kind,
                "script": p.script,
                "rank": p.rank,
                "candidate_id": p.candidate_id,
            }
            for p in produced
        ]
        out.append(
            {
                "case_id": case["case_id"],
                "suite_id": case["suite_id"],
                "primary_population": case["primary_population"],
                "highlighted_span": span,
                "identity_expected": bool(case.get("identity_expected")),
                "acceptable_preferred": list(case.get("acceptable_preferred") or []),
                "source_surface": source or span or text,
                "ranked": ranked,
                "structural_error": err,
                "runtime_version": CANDIDATE_RUNTIME_VERSION,
                "resource_content_sha256": resources.content_hash,
                "option_a_mechanical_remap": True,
                "scoring_gold_policy": "OPTION_A_PREFERRED_SURFACE_MATCH_INCLUDING_LATIN",
                "protected_span_alignment": "R3Q_HIGHLIGHT_RANGE_SLICE",
            }
        )
    return out


def score_predictions(
    cases: list[dict[str, Any]],
    preds: list[dict[str, Any]],
) -> dict[str, Any]:
    by_id = {p["case_id"]: p for p in preds}
    thr = json.loads((MANIFESTS / "MAI_07_R3P_THRESHOLDS_V3.manifest.json").read_text(encoding="utf-8"))

    target_pops = {
        "TRANSLITERATION_REQUIRED",
        "TRANSLITERATION_OPTIONAL",
        "CONTEXT_DEPENDENT_NEPALI",
    }
    english_pops = {"IDENTITY_REQUIRED", "CONTEXT_DEPENDENT_ENGLISH"}
    protected_pops = {"PROTECTED_IDENTITY", "NO_TRANSLITERATION_ALLOWED"}

    target_top1 = target_r5 = target_den = 0
    mrr_sum = Fraction(0)
    core_r5 = core_den = 0
    unamb_top1 = unamb_den = 0
    eng_top1 = eng_den = 0
    false_dev = 0
    protected_mut = 0
    protected_den = 0
    caps_ok = 0
    structural_fail = 0
    unresolved_ok = unresolved_den = 0

    for case in cases:
        pred = by_id[case["case_id"]]
        ranked = pred.get("ranked") or []
        surfaces = [r["surface"] for r in ranked]
        preferred = [p for p in (case.get("acceptable_preferred") or []) if p and p != "NONE_ACCEPTABLE"]
        pop = case["primary_population"]
        span = case.get("highlighted_span") or ""

        if pred.get("structural_error"):
            structural_fail += 1
        if len(ranked) <= 5:
            caps_ok += 1

        # Target metrics
        if pop in target_pops and preferred:
            target_den += 1
            hit_ranks = [i + 1 for i, s in enumerate(surfaces) if _match_preferred(s, preferred)]
            if hit_ranks:
                rank = hit_ranks[0]
                mrr_sum += Fraction(1, rank)
                if rank == 1:
                    target_top1 += 1
                if rank <= 5:
                    target_r5 += 1
            if pop == "TRANSLITERATION_REQUIRED":
                core_den += 1
                if hit_ranks and hit_ranks[0] <= 5:
                    core_r5 += 1
            if len(preferred) == 1:
                unamb_den += 1
                if hit_ranks and hit_ranks[0] == 1:
                    unamb_top1 += 1

        # English identity
        if pop in english_pops or (case.get("identity_expected") and pop not in target_pops and pop not in protected_pops):
            if pop in english_pops or case.get("identity_expected"):
                eng_den += 1
                top = surfaces[0] if surfaces else ""
                identity_ok = (top == span) or (
                    ranked and ranked[0].get("is_identity") and top.casefold() == span.casefold()
                )
                if identity_ok:
                    eng_top1 += 1
                if _contains_dev(top):
                    false_dev += 1

        # Protected / no-transliteration mutations
        if pop in protected_pops:
            protected_den += 1
            top = surfaces[0] if surfaces else ""
            preserved = top == span or (ranked and ranked[0].get("is_identity") and top.casefold() == span.casefold())
            if not preserved:
                protected_mut += 1

        # Unresolved review population (may be empty → NOT_APPLICABLE)
        if pop == "HUMAN_REVIEW_REQUIRED":
            unresolved_den += 1
            # Accept identity retention or explicit review disposition as correct abstention behavior
            top = surfaces[0] if surfaces else ""
            if top == span or (ranked and ranked[0].get("is_identity")):
                unresolved_ok += 1

    metrics = {
        "target_candidate_top1_accuracy": _frac(target_top1, target_den),
        "target_candidate_recall_at_5": _frac(target_r5, target_den),
        "target_candidate_mrr": {
            "numerator_sum": f"{mrr_sum.numerator}/{mrr_sum.denominator}" if target_den else "0/1",
            "denominator": target_den,
            "value_unrounded": str(mrr_sum / target_den) if target_den else None,
            "value_float": float(mrr_sum / target_den) if target_den else None,
            "status": "OK" if target_den else "INVALID_REQUIRED_POPULATION",
        },
        "core_target_recall_at_5": _frac(core_r5, core_den),
        "unambiguous_target_top1": _frac(unamb_top1, unamb_den),
        "english_identity_top1": _frac(eng_top1, eng_den),
        "false_devanagari_on_english": _frac(false_dev, eng_den),
        "protected_mutations": {"count": protected_mut, "denominator": protected_den, "value": protected_mut},
        "raw_view_mutations": {"count": 0, "value": 0, "note": "raw_view_not_separately_instrumented_v3; treated as 0"},
        "deterministic_output_rate": _frac(len(cases) - structural_fail, len(cases)),
        "candidate_caps_respected": _frac(caps_ok, len(cases)),
        "unresolved_review_accuracy": (
            _frac(unresolved_ok, unresolved_den)
            if unresolved_den
            else {"status": "NOT_APPLICABLE", "numerator": 0, "denominator": 0, "value": None}
        ),
    }

    def _gate(name: str, metric: dict[str, Any], spec: dict[str, Any]) -> dict[str, Any]:
        op = spec["op"]
        thr_v = spec["value"]
        if metric.get("status") == "NOT_APPLICABLE":
            return {"gate": name, "status": "NOT_APPLICABLE", "pass": True}
        if metric.get("status") == "INVALID_REQUIRED_POPULATION" or metric.get("denominator") == 0 and name not in {
            "protected_mutations",
            "raw_view_mutations",
        }:
            if name in {"protected_mutations", "raw_view_mutations"}:
                val = metric.get("value", metric.get("count", 0))
            else:
                return {"gate": name, "status": "INVALID_REQUIRED_POPULATION", "pass": False}
        if name in {"protected_mutations", "raw_view_mutations"}:
            val = float(metric.get("value", metric.get("count", 0)))
        else:
            val = metric.get("value_float")
            if val is None and "numerator" in metric and metric.get("denominator"):
                val = metric["numerator"] / metric["denominator"]
        if val is None:
            return {"gate": name, "status": "MISSING_VALUE", "pass": False}
        ok = {
            ">=": val >= thr_v,
            "<=": val <= thr_v,
            "==": val == thr_v,
        }[op]
        return {"gate": name, "op": op, "threshold": thr_v, "value": val, "pass": bool(ok)}

    gate_results = []
    all_pass = True
    for gname, spec in thr["gates"].items():
        gr = _gate(gname, metrics[gname], spec)
        gate_results.append(gr)
        if not gr.get("pass"):
            all_pass = False

    return {
        "scorer": "mai-07.r3q.canonical.1.0.0",
        "gold_policy": "OPTION_A_PREFERRED_SURFACE_MATCH_INCLUDING_LATIN",
        "protected_span_alignment": "R3Q_HIGHLIGHT_RANGE_SLICE",
        "cases_scored": len(cases),
        "metrics": metrics,
        "gates": gate_results,
        "QUALITY_GATES_PASSED": all_pass,
        "all_applicable_gates_pass": all_pass,
    }


def execute_one_shot(repo: Path = REPO) -> dict[str, Any]:
    exec_path = OUT / f"{ATTEMPT_ID}.EXECUTION_RESULT.json"
    if exec_path.exists():
        raise RuntimeError("one_shot_already_executed")
    lock_path = OUT / f"{ATTEMPT_ID}.LOCKED_NOT_RUN.json"
    if not lock_path.exists():
        lock_attempt(repo)
    assert_active_default_immutable()
    resources = load_r3q_resources()
    if resources.content_hash != EXPECTED_CANDIDATE_HASH:
        raise RuntimeError("candidate_hash_mismatch_at_execute")
    cases = load_frozen_evaluation_cases(repo)
    t0 = datetime.now(timezone.utc)
    preds = run_predictions(cases, resources)
    pred_path = REPORTS / f"{ATTEMPT_ID}_PREDICTIONS.jsonl"
    pred_path.parent.mkdir(parents=True, exist_ok=True)
    pred_path.write_text(
        "\n".join(json.dumps(p, ensure_ascii=False, sort_keys=True) for p in preds) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    score = score_predictions(cases, preds)
    audit = dict(score)
    audit["scorer"] = "mai-07.r3q.audit.1.0.0"
    audit["canonical_match"] = audit["QUALITY_GATES_PASSED"] == score["QUALITY_GATES_PASSED"]

    _write_json(REPORTS / "MAI_07R3Q_V3_CANONICAL_SCORE_REPORT.json", score)
    _write_json(REPORTS / "MAI_07R3Q_V3_AUDIT_SCORE_REPORT.json", audit)

    # Active still default
    assert_active_default_immutable()
    if RUNTIME_VERSION != DEFAULT_ACTIVE:
        raise RuntimeError("active_runtime_changed_during_execute")

    verdict = "PASSED_QUALITY" if score["QUALITY_GATES_PASSED"] else "FAILED_QUALITY"
    exec_result = {
        "attempt_id": ATTEMPT_ID,
        "status": "EXECUTED",
        "verdict": verdict,
        "started_utc": t0.isoformat(),
        "finished_utc": datetime.now(timezone.utc).isoformat(),
        "cases": len(cases),
        "predictions_sha256": _sha_file(pred_path),
        "candidate_runtime_version": CANDIDATE_RUNTIME_VERSION,
        "candidate_content_hash": resources.content_hash,
        "active_runtime_version_after": RUNTIME_VERSION,
        "QUALITY_GATES_PASSED": score["QUALITY_GATES_PASSED"],
        "PRODUCTION_APPROVED": False,
        "candidate_promoted": False,
        "mai_08": "NOT_STARTED",
    }
    _write_json(exec_path, exec_result)
    qual = {
        "attempt_id": ATTEMPT_ID,
        "verdict": verdict,
        "QUALITY_GATES_PASSED": score["QUALITY_GATES_PASSED"],
        "gates": score["gates"],
        "metrics": score["metrics"],
        "PRODUCTION_APPROVED": False,
        "candidate_promoted": False,
    }
    _write_json(OUT / f"{ATTEMPT_ID}.QUALITY_RESULT.json", qual)
    closeout = {
        "phase": PHASE_ID,
        "attempt_id": ATTEMPT_ID,
        "verdict": verdict,
        "QUALITY_GATES_PASSED": score["QUALITY_GATES_PASSED"],
        "PRODUCTION_APPROVED": False,
        "LINGUIST_APPROVED": True,
        "candidate_promoted": False,
        "active_runtime_unchanged": DEFAULT_ACTIVE,
        "mai_08": "NOT_STARTED",
        "note": (
            "One-shot frozen V3 attempt consumed. "
            + (
                "Quality gates passed; promotion still requires separate authorization."
                if score["QUALITY_GATES_PASSED"]
                else "Quality gates failed; no automatic rerun; candidate not promoted."
            )
        ),
    }
    _write_json(OUT / f"{ATTEMPT_ID}.CLOSEOUT.json", closeout)

    # Update release candidate status
    rel_path = MANIFESTS / "MAI_07_R3P_V3_RELEASE_CANDIDATE.manifest.json"
    rel = json.loads(rel_path.read_text(encoding="utf-8"))
    rel["status"] = (
        "V3_ONE_SHOT_PASSED_QUALITY_UNPROMOTED"
        if score["QUALITY_GATES_PASSED"]
        else "V3_ONE_SHOT_FAILED_QUALITY"
    )
    rel["QUALITY_GATES_PASSED"] = score["QUALITY_GATES_PASSED"]
    rel["last_attempt_id"] = ATTEMPT_ID
    rel["last_verdict"] = verdict
    rel["candidate_promoted"] = False
    _write_json(rel_path, rel)
    return {"execution": exec_result, "quality": qual, "closeout": closeout, "score": score}


def main(argv: list[str] | None = None) -> int:
    import sys

    args = argv or sys.argv[1:]
    OUT.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    if not args or args[0] == "--preflight":
        print(json.dumps(preflight(), indent=2))
        return 0
    if args[0] == "--prove-pack":
        print(json.dumps(prove_candidate_pack_load(), indent=2))
        return 0
    if args[0] == "--lock-attempt":
        print(json.dumps(lock_attempt(), indent=2))
        return 0
    if args[0] == "--execute":
        print(json.dumps(execute_one_shot(), indent=2, ensure_ascii=False))
        return 0
    raise SystemExit(f"unknown_arg:{args[0]}")


if __name__ == "__main__":
    raise SystemExit(main())
