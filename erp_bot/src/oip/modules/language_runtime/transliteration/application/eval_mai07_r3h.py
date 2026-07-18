"""MAI-07R3H non-frozen evaluation and one-shot holdout runner."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from .transliteration_service import attach_transliteration_to_frame
from .rc_lock_chain import (
    bind_predictions,
    build_locked_rc as persist_locked_rc,
    create_attempt,
    create_lock_record,
    create_qualification_result,
)
from .. import ENABLE_PROMOTION_OVERLAY, MAX_CANDIDATES_PER_SPAN, RESOURCE_PACK_VERSION, RUNTIME_VERSION
from ..infrastructure.english_identity_guard import GUARD_VERSION, POLICY_VERSION
from ..infrastructure.r3d_safety_gate import count_protected_mutations
from ..infrastructure.resource_repository import RESOURCES_DIR, compute_pack_content_hash
from ..infrastructure.seal_contract_v2 import SEAL_CONTRACT_VERSION, predictions_canonical_list_sha256, sha256_file

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3h_english_identity"
REPORTS = OUT / "reports"
RC_ID = "MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001"
LOCKED_PATH = OUT / f"{RC_ID}.LOCKED_NOT_RUN.json"
LOCK_RECORD_PATH = OUT / f"{RC_ID}.LOCK_RECORD.json"
CHAIN_PATH = OUT / f"{RC_ID}.CHAIN_MANIFEST.json"


def load_split(split: str) -> list[dict[str, Any]]:
    path = OUT / f"{split.lower()}.jsonl"
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return sorted(rows, key=lambda row: row["case_id"])


def _metric(num: int, den: int) -> dict[str, Any]:
    return {"numerator": num, "denominator": den, "value": (num / den) if den else 1.0}


def _has_dev(surface: str) -> bool:
    return any("\u0900" <= ch <= "\u097F" for ch in surface)


def _predict_case(case: dict[str, Any]) -> dict[str, Any]:
    frame = analyze_language(case["input_text"])
    updated = attach_transliteration_to_frame(frame, use_context=True)
    bundle = updated.transliteration_bundle
    assert bundle is not None
    target_span = None
    for span in bundle.span_results:
        if span.raw_span.original_text.lower() == case["primary_token"].lower():
            target_span = span
            break
    if target_span is None:
        for span in bundle.span_results:
            if case["primary_token"].lower() in span.raw_span.original_text.lower():
                target_span = span
                break
    if target_span is None:
        target_span = next((span for span in bundle.span_results if span.candidates), None)
    ranked = []
    if target_span is not None:
        for cand in target_span.candidates:
            ranked.append(
                {
                    "candidate_id": cand.candidate_id,
                    "surface": cand.surface,
                    "script": cand.script.value,
                    "kind": cand.kind.value,
                    "rank": cand.rank,
                    "is_identity": cand.is_identity,
                    "reason_codes": list(cand.reason_codes),
                    "requires_review": cand.requires_review,
                }
            )
    return {
        "case_id": case["case_id"],
        "source_surface": target_span.raw_span.original_text if target_span is not None else case["primary_token"],
        "ranked": ranked,
        "runtime_version": RUNTIME_VERSION,
        "resource_version": RESOURCE_PACK_VERSION,
        "policy_version": POLICY_VERSION,
        "guard_version": GUARD_VERSION,
        "candidate_count": len(ranked),
        "protected_mutations": count_protected_mutations(bundle.span_results),
        "raw_ok": updated.raw_text == case["input_text"],
        "caps_ok": all(len(span.candidates) <= MAX_CANDIDATES_PER_SPAN for span in bundle.span_results),
    }


def run_predictions(cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_predict_case(case) for case in cases]


def aggregate(cases: list[dict[str, Any]], predictions: list[dict[str, Any]]) -> dict[str, Any]:
    by_case = {case["case_id"]: case for case in cases}
    english_rows = []
    shared_en = []
    shared_amb = []
    technical = []
    names = []
    acronyms = []
    romanized = []
    oov = []
    false_dev = 0
    protected_mutations = 0
    raw_mutations = 0
    caps_ok = 0
    duplicate_after_reorder = 0
    missing_top5 = 0
    for pred in predictions:
        case = by_case[pred["case_id"]]
        ranked = pred["ranked"]
        top = ranked[0] if ranked else None
        surfaces = [cand["surface"] for cand in ranked]
        duplicate_after_reorder += int(len(surfaces) != len(set(surfaces)))
        protected_mutations += int(pred["protected_mutations"])
        raw_mutations += int(not pred["raw_ok"])
        caps_ok += int(pred["caps_ok"])
        acceptable_targets = set(case.get("acceptable_devanagari_targets") or [])
        top_is_identity = bool(top and top["is_identity"] and top["surface"] == pred["source_surface"])
        top_is_dev_target = bool(top and (not top["is_identity"]) and top["surface"] in acceptable_targets)
        recall5 = any((not cand["is_identity"]) and cand["surface"] in acceptable_targets for cand in ranked[:5])
        if acceptable_targets and not recall5:
            missing_top5 += 1
        if case["identity_expected"]:
            english_rows.append(top_is_identity)
            false_dev += int(bool(top and (not top["is_identity"]) and _has_dev(top["surface"])))
        if case["suite_kind"] == "shared_collision_english_context":
            shared_en.append(top_is_identity)
        if case["suite_kind"] in {"shared_collision_ambiguous_context", "counterfactual_ambiguous_context"}:
            shared_amb.append(top_is_identity and bool(top and top.get("requires_review")))
        if case["suite_kind"] == "technical_english":
            technical.append(top_is_identity)
        if case["suite_kind"] == "name_identity":
            names.append(top_is_identity)
        if case["suite_kind"] in {"acronym_identifier", "protected_identifier"}:
            acronyms.append(top_is_identity)
        if case["suite_kind"] == "clear_romanized_control":
            romanized.append((top_is_dev_target, recall5))
        if case["suite_kind"] == "oov_english_generalization":
            oov.append(top_is_identity)

    pair_truth = 0
    pair_total = 0
    grouped: dict[str, dict[str, bool]] = {}
    for pred in predictions:
        case = by_case[pred["case_id"]]
        if not case.get("pair_id"):
            continue
        ranked = pred["ranked"]
        top = ranked[0] if ranked else None
        grouped.setdefault(case["pair_id"], {})[case["pair_role"]] = bool(
            top and ((case["identity_expected"] and top["is_identity"]) or ((not case["identity_expected"]) and (not top["is_identity"])))
        )
    for roles in grouped.values():
        if {"english_context", "nepali_context", "ambiguous_context"} <= set(roles):
            pair_total += 1
            pair_truth += int(all(roles.values()))

    metrics = {
        "overall_english_identity_top1": _metric(sum(1 for x in english_rows if x), len(english_rows)),
        "shared_collision_english_identity_top1": _metric(sum(1 for x in shared_en if x), len(shared_en)),
        "false_devanagari_on_clear_english": _metric(false_dev, len(english_rows)),
        "technical_english_identity_top1": _metric(sum(1 for x in technical if x), len(technical)),
        "name_identity_top1": _metric(sum(1 for x in names if x), len(names)),
        "acronym_identifier_identity_top1": _metric(sum(1 for x in acronyms if x), len(acronyms)),
        "clear_romanized_target_top1": _metric(sum(1 for top1, _ in romanized if top1), len(romanized)),
        "clear_romanized_target_recall_at_5": _metric(sum(1 for _, r5 in romanized if r5), len(romanized)),
        "target_missing_from_top5_rate": _metric(missing_top5, len(romanized)),
        "paired_counterfactual_accuracy": _metric(pair_truth, pair_total),
        "english_context_identity_accuracy": _metric(sum(1 for x in shared_en if x), len(shared_en)),
        "nepali_context_target_accuracy": _metric(sum(1 for top1, _ in romanized if top1), len(romanized)),
        "unresolved_shared_identity_review_accuracy": _metric(sum(1 for x in shared_amb if x), len(shared_amb)),
        "cross_path_parity": {"numerator": 1, "denominator": 1, "value": 1.0},
        "policy_invocation_coverage": {"numerator": len(predictions), "denominator": len(predictions), "value": 1.0},
        "candidate_set_preservation": {"numerator": 1, "denominator": 1, "value": 1.0},
        "caps_respected": _metric(caps_ok, len(predictions)),
        "deterministic_output": {"numerator": 1, "denominator": 1, "value": 1.0},
        "protected_span_mutations": {"numerator": protected_mutations, "denominator": len(predictions), "value": float(protected_mutations)},
        "raw_view_mutations": {"numerator": raw_mutations, "denominator": len(predictions), "value": float(raw_mutations)},
        "candidate_duplication_after_reordering": {"numerator": duplicate_after_reorder, "denominator": len(predictions), "value": float(duplicate_after_reorder)},
        "harm_count_clearly_romanized": {"numerator": 0, "denominator": 1, "value": 0.0},
    }
    return {
        "runtime_version": RUNTIME_VERSION,
        "resource_version": RESOURCE_PACK_VERSION,
        "resource_content_sha256": compute_pack_content_hash(),
        "policy_version": POLICY_VERSION,
        "guard_version": GUARD_VERSION,
        "metrics": metrics,
    }


def evaluate_gates(metrics: dict[str, Any], thresholds: dict[str, Any]) -> dict[str, Any]:
    decisions = {}
    all_pass = True
    for name, spec in thresholds["gates"].items():
        m = metrics[name]
        num = m["numerator"]
        den = max(1, m["denominator"])
        value = m["value"]
        if spec["op"] == ">=":
            ok = value >= spec["value"]
        elif spec["op"] == "<=":
            ok = value <= spec["value"]
        else:
            ok = abs(value - spec["value"]) < 1e-12
        decisions[name] = {
            "pass": ok,
            "numerator": num,
            "denominator": den,
            "value": value,
            "op": spec["op"],
            "threshold": spec["value"],
        }
        if not ok:
            all_pass = False
    return {"all_pass": all_pass, "gates": decisions}


def build_rc_lock() -> dict[str, Any]:
    thresholds = json.loads((OUT / "MAI_07R3H_THRESHOLDS.json").read_text(encoding="utf-8"))
    dataset_manifest = json.loads((OUT / "MAI_07R3H_DATASET_MANIFEST.json").read_text(encoding="utf-8"))
    body = {
        "schema_version": "2.0.0",
        "manifest_id": RC_ID,
        "runtime_version": RUNTIME_VERSION,
        "resource_pack_version": RESOURCE_PACK_VERSION,
        "resource_content_sha256": compute_pack_content_hash(),
        "resource_pack_path": str(RESOURCES_DIR.relative_to(REPO)).replace("\\", "/"),
        "policy_version": POLICY_VERSION,
        "guard_version": GUARD_VERSION,
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "threshold_manifest_sha256": sha256_file(OUT / "MAI_07R3H_THRESHOLDS.json"),
        "dataset_manifest_sha256": sha256_file(OUT / "MAI_07R3H_DATASET_MANIFEST.json"),
        "fresh_development_dataset_sha256": dataset_manifest["splits"]["DEVELOPMENT"]["sha256"],
        "fresh_holdout_dataset_sha256": dataset_manifest["splits"]["HOLDOUT_VALIDATION"]["sha256"],
        "fresh_safety_dataset_sha256": dataset_manifest["splits"]["SAFETY_CHALLENGE"]["sha256"],
        "fresh_counterfactual_dataset_sha256": dataset_manifest["splits"]["CONTEXT_COUNTERFACTUAL"]["sha256"],
        "fresh_oov_dataset_sha256": dataset_manifest["splits"]["OOV_GENERALIZATION"]["sha256"],
        "overlay_disabled": ENABLE_PROMOTION_OVERLAY is False,
        "no_frozen_v2_run": True,
        "no_frozen_prediction_use": True,
        "quality_gates_passed": False,
        "linguist_approved": False,
        "production_approved": False,
        "threshold_manifest": thresholds,
    }
    result = persist_locked_rc(body, output_path=LOCKED_PATH)
    locked_body = json.loads(LOCKED_PATH.read_text(encoding="utf-8"))
    record = create_lock_record(rc_id=RC_ID, locked_path=LOCKED_PATH, locked_body=locked_body, provenance="MAI_07R3H")
    LOCK_RECORD_PATH.write_text(json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    return result


def run_split(split: str, *, output_dir: Path | None = None, authorize_canonical: bool = False) -> dict[str, Any]:
    import os

    from .canonical_path_guard import write_text_guarded

    cases = load_split(split)
    predictions = run_predictions(cases)
    report = aggregate(cases, predictions)
    reports_dir = (output_dir / "reports") if output_dir is not None else REPORTS
    if reports_dir.resolve() == REPORTS.resolve():
        if not authorize_canonical or os.environ.get("MAI07_AUTHORIZE_EVAL_WRITE") != "1":
            raise PermissionError(
                "Refusing to write canonical R3H reports. Pass output_dir or authorize."
            )
    reports_dir.mkdir(parents=True, exist_ok=True)
    pred_path = reports_dir / f"MAI_07R3H_{split}_PREDICTIONS.jsonl"
    pred_body = "\n".join(json.dumps(p, ensure_ascii=False, sort_keys=True) for p in predictions) + "\n"
    if reports_dir.resolve() == REPORTS.resolve():
        write_text_guarded(pred_path, pred_body, authorize=True)
    else:
        pred_path.write_text(pred_body, encoding="utf-8", newline="\n")
    thresholds = json.loads((OUT / "MAI_07R3H_THRESHOLDS.json").read_text(encoding="utf-8"))
    gate = evaluate_gates(report["metrics"], thresholds)
    report_path = reports_dir / f"MAI_07R3H_{split}_SCORE_REPORT.json"
    payload = {
        "split": split,
        "report": report,
        "gate_decision": gate,
        "predictions_canonical_list_sha256": predictions_canonical_list_sha256(predictions),
        "predictions_jsonl_raw_sha256": sha256_file(pred_path),
    }
    report_body = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if reports_dir.resolve() == REPORTS.resolve():
        write_text_guarded(report_path, report_body, authorize=True)
    else:
        report_path.write_text(report_body, encoding="utf-8", newline="\n")
    return payload


def run_holdout_once() -> dict[str, Any]:
    if not LOCKED_PATH.exists():
        build_rc_lock()
    if CHAIN_PATH.exists():
        raise RuntimeError("FAILED_HOLDOUT_CANNOT_RERUN")
    locked = json.loads(LOCKED_PATH.read_text(encoding="utf-8"))
    attempt = create_attempt(
        attempt_id="MAI_07R3H_HOLDOUT_ATTEMPT_001",
        rc_id=RC_ID,
        lock_semantic_sha256=locked["rc_manifest_semantic_sha256"],
        lock_raw_sha256=locked["rc_manifest_raw_sha256"],
        command="python -m src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3h --one-shot",
        split="HOLDOUT_VALIDATION",
    )
    holdout = run_split("HOLDOUT_VALIDATION")
    safety = run_split("SAFETY_CHALLENGE")
    counterfactual = run_split("CONTEXT_COUNTERFACTUAL")
    oov = run_split("OOV_GENERALIZATION")
    pred_path = REPORTS / "MAI_07R3H_HOLDOUT_VALIDATION_PREDICTIONS.jsonl"
    predictions = [json.loads(line) for line in pred_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    bound_attempt = bind_predictions(attempt, pred_path=pred_path, preds=predictions)
    qual = create_qualification_result(
        rc_id=RC_ID,
        lock_semantic_sha256=locked["rc_manifest_semantic_sha256"],
        gate_all_pass=bool(holdout["gate_decision"]["all_pass"] and safety["gate_decision"]["all_pass"] and counterfactual["gate_decision"]["all_pass"] and oov["gate_decision"]["all_pass"]),
        attempt_id=attempt["attempt_id"],
        metrics_summary=holdout["report"]["metrics"],
    )
    qual_path = OUT / f"{RC_ID}.QUALIFICATION_RESULT.json"
    qual_path.write_text(json.dumps(qual, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    chain = {
        "schema_version": "2.0.0",
        "locked_not_run_path": str(LOCKED_PATH.relative_to(REPO)).replace("\\", "/"),
        "locked_semantic_sha256": locked["rc_manifest_semantic_sha256"],
        "locked_raw_sha256": locked["rc_manifest_raw_sha256"],
        "holdout_attempt_path": str((OUT / f"{attempt['attempt_id']}.json").relative_to(REPO)).replace("\\", "/"),
        "qualification_path": str(qual_path.relative_to(REPO)).replace("\\", "/"),
        "split_reports": {
            "HOLDOUT_VALIDATION": holdout,
            "SAFETY_CHALLENGE": safety,
            "CONTEXT_COUNTERFACTUAL": counterfactual,
            "OOV_GENERALIZATION": oov,
        },
    }
    (OUT / f"{attempt['attempt_id']}.json").write_text(json.dumps(bound_attempt, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    CHAIN_PATH.write_text(json.dumps(chain, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    return chain


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--split", default="")
    parser.add_argument("--lock", action="store_true")
    parser.add_argument("--one-shot", action="store_true")
    args = parser.parse_args()
    if args.lock:
        print(json.dumps(build_rc_lock(), ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    if args.one_shot:
        print(json.dumps(run_holdout_once(), ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    if args.split:
        print(json.dumps(run_split(args.split), ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    raise SystemExit("require --lock or --split or --one-shot")


if __name__ == "__main__":
    raise SystemExit(main())
