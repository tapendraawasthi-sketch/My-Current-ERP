"""MAI-07R3G — frozen-V2 evaluation of sealed R3F RC (preflight + one-shot).

R3G is evaluation-only. If sealed R3F resource / holdout evidence drifts,
preflight returns BLOCKED_PRECONDITION_FAILED and must not open frozen V2.
"""

from __future__ import annotations

import hashlib
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .. import (
    ENABLE_PROMOTION_OVERLAY,
    ENGLISH_IDENTITY_GUARD_VERSION,
    PARENT_R3E_ATTEMPT_HASH,
    RESOURCE_PACK_VERSION,
    RUNTIME_VERSION,
)
from ..infrastructure import resource_repository as xlrr

REPO = Path(__file__).resolve().parents[7]
R3F = REPO / "evals/mai07_r3f_english_identity"
R3G = REPO / "evals/mai07/r3g"
REPORTS = R3G / "reports"
R3E = REPO / "evals/mai07/r3e"

EXPECTED = {
    # Historical sealed R3F RC identity (INVALIDATED_BY_SEAL_DRIFT). Active runtime is SEAL-NEW.
    "runtime": "mai-07.1.2-r3f",
    "resource": "e94cc8c7775d9ce77ab854ab478387d950a018ba1b76d96e9749d4aad425e50a",
    "rc_content": "37e551f29126fea63f77b9cb6b3bc4e867185b61a620b5686ed8471bf10396dd",
    "guard_config": "9240a7be24937e2c03507875f2d7b3e1918132ff7d61074af2cc05883e52a076",
    "guard_version": "mai-07-r3f.1.0.0",
    "v1": "5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208",
    "v2": "0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9",
    "v2_man": "17331e4d0c703977b80ca893eb5261bb126aa52a6813fe8b4f548b1178c716be",
    "pop": "a8461f62acac98561605e5b2ffb2475bb73a3d15cf0f32ef7b98f1247de85632",
    "thr": "aa4b5d68852edbed7cdc5f025b8051b3235078a65fb78bb0aca3a342fcdf04ef",
    "r3e_attempt": "833233e4f5ed5250a824e47dcfec000fa4d66ae20dfeec1729822e43bf81fbd2",
    "r3e_pred": "89ee4789333bc1fd5b5ea3b1b505c0a53b7a5f7e159d5966511ead52735a7e9c",
    "holdout_pred_reported": "b5cdb56f966a84fd77c2c2727f7dd5269bc16cf90406eb386899fa1d7b5e5a6d",
    "canonical_scorer_lf": "6e8e30c9c6e2c38d3ea61243e0a22a72e8eb3e17e3d854a0a9a3467b130e9336",
    "audit_scorer_lf": "c0d7799b5d54057ea768b8c67f9516edefc713d8ebd2d59120f16df3bc102450",
    "active_runtime_after_seal_new": "mai-07.1.3-r3f-sealnew",
}


def _sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha_file(path: Path) -> str:
    return _sha_bytes(path.read_bytes())


def _sha_lf(path: Path) -> str:
    return _sha_bytes(path.read_bytes().replace(b"\r\n", b"\n").replace(b"\r", b"\n"))


def _canonical(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def rc_content_hash(repo: Path = REPO) -> str:
    rc = json.loads((repo / R3F.relative_to(REPO) / "MAI_07R3F_RELEASE_CANDIDATE.manifest.json").read_text(encoding="utf-8"))
    body = {k: v for k, v in rc.items() if k != "manifest_sha256"}
    return _sha_bytes(
        (json.dumps(body, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    )


def recompute_v1_hash(repo: Path = REPO) -> str:
    man = json.loads(
        (repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    h = hashlib.sha256()
    for f in sorted(man["files"], key=lambda x: x["suite_id"]):
        h.update(f["suite_id"].encode())
        h.update(b"\0")
        h.update((repo / f["path"]).read_bytes())
    return h.hexdigest()


def recompute_v2_hash(repo: Path = REPO) -> str:
    man = json.loads(
        (repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    h = hashlib.sha256()
    for f in sorted(man["files"], key=lambda x: x["suite_id"]):
        h.update(f["suite_id"].encode())
        h.update(b"\0")
        h.update((repo / f["path"]).read_bytes())
    return h.hexdigest()


def pack_hash_lf(repo: Path = REPO) -> str:
    man = json.loads(
        (
            repo
            / "erp_bot/src/oip/modules/language_runtime/transliteration/resources/manifest.json"
        ).read_text(encoding="utf-8")
    )
    res_dir = (
        repo / "erp_bot/src/oip/modules/language_runtime/transliteration/resources"
    )
    h = hashlib.sha256()
    for name in sorted(str(x) for x in man.get("files", [])):
        b = (res_dir / name).read_bytes().replace(b"\r\n", b"\n").replace(b"\r", b"\n")
        h.update(name.encode("utf-8"))
        h.update(b"\0")
        h.update(b)
    return h.hexdigest()


def validate_r3f_holdout_evidence(repo: Path = REPO) -> dict[str, Any]:
    rc_path = R3F / "MAI_07R3F_RELEASE_CANDIDATE.manifest.json"
    rc = json.loads(rc_path.read_text(encoding="utf-8"))
    ds = json.loads((R3F / "MAI_07R3F_DATASET_MANIFEST.json").read_text(encoding="utf-8"))
    thr_hash = _sha_file(R3F / "MAI_07R3F_HOLDOUT_THRESHOLDS.json")
    pred_path = R3F / "reports/MAI_07R3F_HOLDOUT_VALIDATION_PREDICTIONS.jsonl"
    rep_path = R3F / "reports/MAI_07R3F_HOLDOUT_VALIDATION_SCORE_REPORT.json"
    cf_path = R3F / "reports/MAI_07R3F_CONTEXT_COUNTERFACTUAL_SCORE_REPORT.json"
    pred_file_hash = _sha_file(pred_path)
    # Producer contract (eval_mai07_r3f): predictions_sha256 = SHA256(canonical JSON list),
    # NOT the JSONL file raw bytes. See MAI-07R3F-SEAL-RESTORE hash-contract spec.
    preds = [
        json.loads(ln)
        for ln in pred_path.read_text(encoding="utf-8").splitlines()
        if ln.strip()
    ]
    pred_canonical_list_hash = _sha_bytes(_canonical(preds).encode("utf-8"))
    rep_hash = _sha_file(rep_path)
    rep = json.loads(rep_path.read_text(encoding="utf-8"))
    cf = json.loads(cf_path.read_text(encoding="utf-8"))
    missing: list[str] = []

    if not rc.get("locked") or not rc.get("locked_before_holdout"):
        missing.append("rc_not_locked_before_holdout")
    if rc_content_hash(repo) != EXPECTED["rc_content"]:
        missing.append("rc_content_hash_mismatch")
    if ds["splits"]["DEVELOPMENT"]["sha256"] != rc["development_dataset_sha256"]:
        missing.append("development_dataset_hash_mismatch")
    if ds["splits"]["HOLDOUT_VALIDATION"]["sha256"] != rc["holdout_dataset_sha256"]:
        missing.append("holdout_dataset_hash_mismatch")
    if ds["splits"]["SAFETY_CHALLENGE"]["sha256"] != rc["safety_dataset_sha256"]:
        missing.append("safety_dataset_hash_mismatch")
    if ds["splits"]["CONTEXT_COUNTERFACTUAL"]["sha256"] != rc["counterfactual_dataset_sha256"]:
        missing.append("counterfactual_dataset_hash_mismatch")
    if thr_hash != rc["threshold_sha256"]:
        missing.append("threshold_hash_mismatch")
    reported_pred = rep.get("predictions_sha256")
    if pred_canonical_list_hash != reported_pred:
        missing.append(
            "holdout_prediction_canonical_list_hash_mismatch:"
            f"computed={pred_canonical_list_hash}:report={reported_pred}"
        )
    if reported_pred != EXPECTED["holdout_pred_reported"]:
        missing.append("holdout_prediction_reported_hash_unexpected")
    if rep["report"]["metrics"] != rep["audit"]["metrics"]:
        missing.append("canonical_audit_metrics_disagree")
    if not rep["gate_decision"]["all_pass"]:
        missing.append("holdout_gates_not_all_pass")
    if not cf["gate_decision"]["all_pass"]:
        missing.append("counterfactual_gates_not_all_pass")

    gates = rep["gate_decision"]["gates"]
    for harm_key in (
        "english_identity_harm",
        "romanized_target_top1_harm",
        "target_recall_at_5_harm",
        "proper_name_harm",
        "protected_harm",
    ):
        if gates.get(harm_key, {}).get("numerator", 0) != 0:
            missing.append(f"{harm_key}_nonzero")
    if gates.get("protected_span_mutations", {}).get("numerator", 0) != 0:
        missing.append("protected_mutations_nonzero")
    if gates.get("raw_view_mutations", {}).get("numerator", 0) != 0:
        missing.append("raw_view_mutations_nonzero")

    eng = gates.get("english_identity_top1", {})
    if eng.get("numerator") != 752 or eng.get("denominator") != 752:
        missing.append("english_identity_nd_unexpected")
    false_dev = gates.get("false_devanagari_on_english", {})
    if false_dev.get("numerator") != 0 or false_dev.get("denominator") != 752:
        missing.append("false_devanagari_nd_unexpected")
    rom = gates.get("high_confidence_romanized_target_top1", {})
    if rom.get("numerator") != 272 or rom.get("denominator") != 272:
        missing.append("romanized_target_nd_unexpected")
    if gates.get("candidate_set_preservation", {}).get("exact_value") != 1.0:
        missing.append("candidate_set_preservation_not_1")
    if gates.get("deterministic_output", {}).get("exact_value") != 1.0:
        missing.append("deterministic_output_not_1")
    if gates.get("caps_respected", {}).get("numerator") != 1036:
        missing.append("caps_respected_unexpected")

    cf_pair = cf["gate_decision"]["gates"].get("context_counterfactual_pair_accuracy", {})
    if cf_pair.get("numerator") != 211 or cf_pair.get("denominator") != 211:
        # tolerate metric key naming variants
        metrics = cf.get("report", {}).get("metrics", {})
        pair = metrics.get("context_counterfactual_pair_accuracy", {})
        if pair.get("numerator") != 211 or pair.get("denominator") != 211:
            missing.append("context_counterfactual_nd_unexpected")

    if rc.get("resource_content_hash") != EXPECTED["resource"]:
        missing.append("rc_resource_claim_mismatch")
    if rc.get("runtime_version") != EXPECTED["runtime"]:
        missing.append("rc_runtime_version_mismatch")
    if ENABLE_PROMOTION_OVERLAY is not False:
        missing.append("overlay_enabled")
    if rc_path.stat().st_mtime > pred_path.stat().st_mtime + 1.0:
        missing.append("rc_mtime_after_holdout_predictions")

    audit_metrics_hash = _sha_bytes(_canonical(rep["audit"]["metrics"]).encode("utf-8"))
    return {
        "ok": not missing,
        "missing": missing,
        "development_dataset_sha256": rc["development_dataset_sha256"],
        "holdout_dataset_sha256": rc["holdout_dataset_sha256"],
        "safety_dataset_sha256": rc["safety_dataset_sha256"],
        "counterfactual_dataset_sha256": rc["counterfactual_dataset_sha256"],
        "threshold_sha256": thr_hash,
        "predictions_sha256_file_raw": pred_file_hash,
        "predictions_sha256_canonical_list": pred_canonical_list_hash,
        "predictions_sha256_reported": reported_pred,
        "predictions_hash_contract": "canonical_json_list_sha256_v1",
        "canonical_report_sha256": rep_hash,
        "independent_audit_metrics_sha256": audit_metrics_hash,
        "gates": gates,
        "rc_locked_before_holdout": bool(rc.get("locked_before_holdout")),
        "rc_mtime_utc": datetime.fromtimestamp(rc_path.stat().st_mtime, timezone.utc).isoformat(),
        "pred_mtime_utc": datetime.fromtimestamp(pred_path.stat().st_mtime, timezone.utc).isoformat(),
    }


def immutability_preflight(repo: Path = REPO) -> dict[str, Any]:
    xlrr.load_resources(force_reload=True)
    app = (
        repo
        / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
    )
    guard_path = (
        repo
        / "erp_bot/src/oip/modules/language_runtime/transliteration/resources/r3f_english_identity_guard.json"
    )
    scores = {
        "v1": recompute_v1_hash(repo),
        "v2": recompute_v2_hash(repo),
        "v2_man": _sha_file(
            repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json"
        ),
        "pop": _sha_file(repo / "evals/mai07/manifests/MAI_07_R3C_POPULATIONS_V2.manifest.json"),
        "thr": _sha_file(repo / "evals/mai07/manifests/MAI_07_R3C_THRESHOLDS_V1.manifest.json"),
        "r3e_pred": _sha_file(
            repo / "evals/mai07/r3e/reports/MAI_07R3E_V2_ONE_SHOT_PREDICTIONS.jsonl"
        ),
        "r3e_attempt_content": json.loads(
            (repo / "evals/mai07/r3e/MAI_07R3E_FROZEN_V2_ATTEMPT.manifest.json").read_text(
                encoding="utf-8"
            )
        ).get("manifest_content_sha256"),
        "rc_content": rc_content_hash(repo),
        "resource_raw": xlrr.compute_pack_content_hash(),
        "resource_lf": pack_hash_lf(repo),
        "guard_config_raw": _sha_file(guard_path),
        "guard_config_lf": _sha_lf(guard_path),
        "canonical_scorer_raw": _sha_file(app / "eval_scoring_r3c.py"),
        "canonical_scorer_lf": _sha_lf(app / "eval_scoring_r3c.py"),
        "audit_scorer_raw": _sha_file(app / "eval_audit_scorer_r3c.py"),
        "audit_scorer_lf": _sha_lf(app / "eval_audit_scorer_r3c.py"),
    }
    errors: list[str] = []
    for k, exp in (
        ("v1", EXPECTED["v1"]),
        ("v2", EXPECTED["v2"]),
        ("v2_man", EXPECTED["v2_man"]),
        ("pop", EXPECTED["pop"]),
        ("thr", EXPECTED["thr"]),
        ("r3e_pred", EXPECTED["r3e_pred"]),
        ("r3e_attempt_content", EXPECTED["r3e_attempt"]),
        ("rc_content", EXPECTED["rc_content"]),
        ("resource_raw", EXPECTED["resource"]),
        ("guard_config_lf", EXPECTED["guard_config"]),
        ("canonical_scorer_lf", EXPECTED["canonical_scorer_lf"]),
        ("audit_scorer_lf", EXPECTED["audit_scorer_lf"]),
    ):
        if scores[k] != exp:
            errors.append(f"{k}:{scores[k]}!={exp}")
    if RUNTIME_VERSION != EXPECTED["runtime"]:
        # After SEAL-NEW, active runtime advances; historical R3F RC remains blocked.
        if RUNTIME_VERSION != EXPECTED.get("active_runtime_after_seal_new"):
            errors.append(f"runtime:{RUNTIME_VERSION}")
        else:
            errors.append(
                f"runtime_advanced_seal_new:{RUNTIME_VERSION}:historical_rc_requires:{EXPECTED['runtime']}"
            )
    if RESOURCE_PACK_VERSION != EXPECTED["runtime"]:
        if RESOURCE_PACK_VERSION != EXPECTED.get("active_runtime_after_seal_new"):
            errors.append(f"pack_version:{RESOURCE_PACK_VERSION}")
        else:
            errors.append(
                f"pack_advanced_seal_new:{RESOURCE_PACK_VERSION}:historical_rc_requires:{EXPECTED['runtime']}"
            )
    if ENGLISH_IDENTITY_GUARD_VERSION != EXPECTED["guard_version"]:
        errors.append(f"guard_version:{ENGLISH_IDENTITY_GUARD_VERSION}")
    if PARENT_R3E_ATTEMPT_HASH != EXPECTED["r3e_attempt"]:
        errors.append("parent_r3e_attempt_constant_drift")
    if ENABLE_PROMOTION_OVERLAY is not False:
        errors.append("overlay_enabled")
    # Diagnostic: LF pack recovery must also match sealed resource; if not, content drifted.
    if scores["resource_lf"] != EXPECTED["resource"]:
        errors.append(
            f"resource_lf_unrecoverable:{scores['resource_lf']}!={EXPECTED['resource']}"
        )
    pop = json.loads(
        (repo / "evals/mai07/manifests/MAI_07_R3C_POPULATIONS_V2.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    return {
        "ok": not errors,
        "errors": errors,
        "hashes": scores,
        "population_counts": pop["counts"],
        "core_target_denominator": pop["core_target_denominator"],
        "unambiguous_target_denominator": pop["unambiguous_target_denominator"],
        "total_cases": pop["total_cases"],
        "runtime_version": RUNTIME_VERSION,
        "resource_pack_version": RESOURCE_PACK_VERSION,
        "guard_version": ENGLISH_IDENTITY_GUARD_VERSION,
        "overlay": ENABLE_PROMOTION_OVERLAY,
    }


def write_preflight_bundle(repo: Path = REPO) -> dict[str, Any]:
    REPORTS.mkdir(parents=True, exist_ok=True)
    hold = validate_r3f_holdout_evidence(repo)
    imm = immutability_preflight(repo)
    status = (
        "PREFLIGHT_OK"
        if hold["ok"] and imm["ok"]
        else "BLOCKED_PRECONDITION_FAILED"
    )
    bundle = {
        "status": status,
        "holdout": hold,
        "immutability": imm,
        "frozen_v2_opened": False,
        "attempt_locked": False,
        "one_shot_executed": False,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "environment_fingerprint": {
            "python": sys.version.split()[0],
            "platform": platform.platform(),
            "machine": platform.machine(),
        },
        "note": (
            "Frozen V2 must not be opened when status != PREFLIGHT_OK. "
            "R3G does not repair runtime/resources/scorers."
        ),
    }
    path = REPORTS / "MAI_07R3G_PREFLIGHT_REPORT.json"
    path.write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return bundle


def main() -> int:
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--preflight", action="store_true")
    p.add_argument("--lock-attempt", action="store_true")
    p.add_argument("--execute", action="store_true")
    args = p.parse_args()
    if args.lock_attempt or args.execute:
        # Hard stop: never consume frozen V2 when preflight is not green.
        out = write_preflight_bundle(REPO)
        if out["status"] != "PREFLIGHT_OK":
            print(
                json.dumps(
                    {
                        "status": "BLOCKED_PRECONDITION_FAILED",
                        "blocked_action": "lock_attempt" if args.lock_attempt else "execute",
                        "missing": out["holdout"].get("missing"),
                        "immutability_errors": out["immutability"].get("errors"),
                    },
                    indent=2,
                    sort_keys=True,
                )
            )
            return 2
        print(
            json.dumps(
                {
                    "status": "ERROR",
                    "message": "lock/execute not implemented while prior preflight was green in this build; re-run after seal restore",
                },
                indent=2,
            )
        )
        return 3
    out = write_preflight_bundle(REPO)
    print(
        json.dumps(
            {
                "status": out["status"],
                "ok": out["status"] == "PREFLIGHT_OK",
                "missing": out["holdout"].get("missing"),
                "immutability_errors": out["immutability"].get("errors"),
                "resource_raw": out["immutability"]["hashes"]["resource_raw"],
                "resource_expected": EXPECTED["resource"],
                "holdout_pred_file_raw": out["holdout"].get("predictions_sha256_file_raw"),
                "holdout_pred_canonical_list": out["holdout"].get("predictions_sha256_canonical_list"),
                "holdout_pred_reported": out["holdout"].get("predictions_sha256_reported"),
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0 if out["status"] == "PREFLIGHT_OK" else 2


if __name__ == "__main__":
    raise SystemExit(main())
