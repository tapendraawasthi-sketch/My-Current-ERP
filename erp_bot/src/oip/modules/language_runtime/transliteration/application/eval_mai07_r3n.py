"""MAI-07R3N non-frozen policy-conformance corrective evaluation runner.

Uses the R3N sealed pack explicitly via load_r3n_resources / transliterate_r3n.
Never mutates ACTIVE_PACK_VERSION or enables the overlay.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

from .eval_mai07_r3n_audit_scorer import compare_canonical_audit, observe_case_audit, score_observations_audit
from .eval_mai07_r3n_canonical_scorer import observe_case, score_observations
from .mai07_r3n_candidate_runtime import (
    CANDIDATE_POLICY_VERSION,
    CANDIDATE_RUNTIME_VERSION,
    PARENT_RESOURCE_HASH,
    PARENT_RUNTIME_VERSION,
    assert_active_default_immutable,
    candidate_identity_card,
    load_r3n_resources,
    transliterate_r3n,
)
from .rc_lock_chain import (
    bind_predictions,
    build_locked_rc,
    create_attempt,
    create_lock_record,
    create_qualification_result,
)
from .transliteration_service import transliterate_frame
from ...application.language_analyzer import analyze_language
from ...normalization.application.normalization_service import attach_normalization_to_frame
from .. import ENABLE_PROMOTION_OVERLAY, RUNTIME_VERSION
from ..infrastructure.resource_repository import load_resources
from ..infrastructure.seal_contract_v2 import SEAL_CONTRACT_VERSION, predictions_canonical_list_sha256, sha256_file
from .build_mai07r3n_pack import PACK_VERSION, check_existing as check_pack

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3n_policy_conformance"
REPORTS = OUT / "reports"
RC_ID = "MAI_07R3N_POLICY_CONFORMANCE_RELEASE_CANDIDATE_002"
LOCKED_PATH = OUT / f"{RC_ID}.LOCKED_NOT_RUN.json"
LOCK_RECORD_PATH = OUT / f"{RC_ID}.LOCK_RECORD.json"
CHAIN_PATH = OUT / f"{RC_ID}.CHAIN_MANIFEST.json"
THRESHOLDS_PATH = OUT / "MAI_07R3N_THRESHOLDS.json"
AUTHORIZE_ENV = "MAI07_AUTHORIZE_EVAL_WRITE"

SPLIT_FILES = {
    "DEVELOPMENT": "development.jsonl",
    "HOLDOUT_VALIDATION": "holdout_validation.jsonl",
    "SAFETY_CHALLENGE": "safety_challenge.jsonl",
    "CONTEXT_COUNTERFACTUAL": "context_counterfactual.jsonl",
    "OOV_CHALLENGE": "oov_challenge.jsonl",
    "MONOTONIC_REGRESSION": "monotonic_regression.jsonl",
}


def _require_write() -> None:
    if os.environ.get(AUTHORIZE_ENV) != "1":
        raise PermissionError(f"Set {AUTHORIZE_ENV}=1 to authorize R3N evaluation writes")


def _write_json(path: Path, obj: Any) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")
    return sha256_file(path)


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(r, ensure_ascii=False, sort_keys=True, separators=(",", ":")) for r in rows]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8", newline="\n")
    return sha256_file(path)


def load_split(split: str) -> list[dict[str, Any]]:
    path = OUT / SPLIT_FILES[split]
    return [json.loads(ln) for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]


def load_thresholds() -> dict[str, Any]:
    return json.loads(THRESHOLDS_PATH.read_text(encoding="utf-8"))


def run_predictions(cases: list[dict[str, Any]], *, use_r3n: bool = True) -> list[dict[str, Any]]:
    assert_active_default_immutable()
    rows: list[dict[str, Any]] = []
    if use_r3n:
        res = load_r3n_resources()
    else:
        res = load_resources()
    for case in cases:
        if use_r3n:
            bundle = transliterate_r3n(case["input_text"], resources=res)
        else:
            frame = attach_normalization_to_frame(analyze_language(case["input_text"]))
            bundle = transliterate_frame(frame, resources=res, use_context=True)
        # Persist prediction summary without embedding full surfaces in public reports later
        span_matches = [
            s for s in bundle.span_results if s.raw_span.original_text.lower() == case["highlighted_span"].lower()
        ]
        span = span_matches[0] if span_matches else None
        cands = []
        if span is not None:
            for c in span.candidates:
                cands.append(
                    {
                        "rank": c.rank,
                        "is_identity": c.is_identity,
                        "has_devanagari": any(0x0900 <= ord(ch) <= 0x097F for ch in c.surface),
                        "surface_len": len(c.surface),
                    }
                )
        rows.append(
            {
                "case_id": case["case_id"],
                "runtime": CANDIDATE_RUNTIME_VERSION if use_r3n else PARENT_RUNTIME_VERSION,
                "span_found": span is not None,
                "eligibility": getattr(getattr(span, "eligibility", None), "value", None) if span else None,
                "candidates": cands,
                "bundle_ref": id(bundle),  # ephemeral; scorer uses live bundles below
            }
        )
    return rows


def score_split(split: str, *, write: bool = False) -> dict[str, Any]:
    assert_active_default_immutable()
    cases = load_split(split)
    thresholds = load_thresholds()
    res = load_r3n_resources()
    observations = []
    audit_obs = []
    bundles = {}
    for case in cases:
        bundle = transliterate_r3n(case["input_text"], resources=res)
        bundles[case["case_id"]] = bundle
        observations.append(observe_case(case, bundle))
        audit_obs.append(observe_case_audit(case, bundle))
    # Determinism check: second pass
    for case in cases:
        b2 = transliterate_r3n(case["input_text"], resources=res)
        o1 = observe_case(case, bundles[case["case_id"]])
        o2 = observe_case(case, b2)
        if (o1["identity_top1"], o1["candidate_count"]) != (o2["identity_top1"], o2["candidate_count"]):
            raise RuntimeError(f"nondeterministic:{case['case_id']}")

    canonical = score_observations(cases, observations, thresholds=thresholds, split=split)
    audit = score_observations_audit(cases, audit_obs, thresholds=thresholds, split=split)
    agreement = compare_canonical_audit(canonical, audit)
    canonical["canonical_audit_agreement"] = agreement
    if not agreement["ok"]:
        canonical["ok"] = False
        canonical["failed_gates"] = list(canonical.get("failed_gates") or []) + ["canonical_audit_agreement"]

    # Extra invariant gates
    raw_mut = sum(1 for o in observations if not o["raw_text_unchanged"])
    if raw_mut != 0:
        canonical["ok"] = False
        canonical["failed_gates"] = list(canonical.get("failed_gates") or []) + ["raw_mutation_count"]

    result = {
        "split": split,
        "case_count": len(cases),
        "canonical": canonical,
        "audit": audit,
        "agreement": agreement,
        "candidate": candidate_identity_card(),
        "active_runtime": RUNTIME_VERSION,
        "overlay_enabled": ENABLE_PROMOTION_OVERLAY,
        "ok": canonical["ok"] and agreement["ok"],
    }
    if write:
        _require_write()
        REPORTS.mkdir(parents=True, exist_ok=True)
        pred_path = REPORTS / f"{split.lower()}_predictions.jsonl"
        # Rebuild prediction file without ephemeral refs
        pred_rows = []
        for case in cases:
            obs = next(o for o in observations if o["case_id"] == case["case_id"])
            pred_rows.append(
                {
                    "case_id": case["case_id"],
                    "span_found": obs["span_found"],
                    "identity_top1": obs["identity_top1"],
                    "identity_retained": obs["identity_retained"],
                    "false_devanagari_top1": obs["false_devanagari_top1"],
                    "devanagari_at_5": obs["devanagari_at_5"],
                    "caps_ok": obs["caps_ok"],
                    "candidate_count": obs["candidate_count"],
                    "runtime": CANDIDATE_RUNTIME_VERSION,
                }
            )
        raw_sha = _write_jsonl(pred_path, pred_rows)
        sem_sha = predictions_canonical_list_sha256(pred_rows)
        _write_json(
            REPORTS / f"{split.lower()}_score_report.json",
            {
                **result,
                "predictions_raw_sha256": raw_sha,
                "predictions_canonical_list_sha256": sem_sha,
            },
        )
        result["predictions_raw_sha256"] = raw_sha
        result["predictions_canonical_list_sha256"] = sem_sha
    return result


def lock_rc(*, write: bool = True) -> dict[str, Any]:
    """Lock RC only after DEVELOPMENT passes. Must precede holdout."""
    assert_active_default_immutable()
    pack = check_pack()
    if not pack.get("ok"):
        raise RuntimeError(f"BLOCKED_PRECONDITION_FAILED:pack:{pack}")
    dev = score_split("DEVELOPMENT", write=write)
    if not dev["ok"]:
        return {
            "verdict": "FAILED_DEVELOPMENT",
            "development": {"ok": False, "failed_gates": dev["canonical"].get("failed_gates")},
            "locked": False,
        }
    if not write:
        return {"verdict": "READY_TO_LOCK", "development": {"ok": True}, "locked": False}

    _require_write()
    thresholds = load_thresholds()
    thr_hash = sha256_file(THRESHOLDS_PATH)
    manifest_path = OUT / "MANIFEST.json"
    dataset_manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.is_file() else {}
    body = {
        "schema_version": "2.0.0",
        "manifest_id": RC_ID,
        "runtime_version": RUNTIME_VERSION,
        "runtime_claim": CANDIDATE_RUNTIME_VERSION,
        "resource_pack_version": PACK_VERSION,
        "resource_content_sha256": pack["content_hash"],
        "candidate_policy_version": CANDIDATE_POLICY_VERSION,
        "parent_runtime_version": PARENT_RUNTIME_VERSION,
        "parent_resource_hash": PARENT_RESOURCE_HASH,
        "active_default_pack_version_unchanged": PARENT_RUNTIME_VERSION,
        "overlay_enabled": False,
        "default_active": False,
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "threshold_manifest_sha256": thr_hash,
        "dataset_manifest_sha256": sha256_file(manifest_path) if manifest_path.is_file() else None,
        "dataset_manifest": dataset_manifest,
        "development_score_all_required_pass": True,
        "development_predictions_raw_sha256": dev.get("predictions_raw_sha256"),
        "development_predictions_canonical_list_sha256": dev.get("predictions_canonical_list_sha256"),
        "no_frozen_v2_run": True,
        "no_frozen_prediction_use": True,
        "quality_gates_passed": False,
        "linguist_approved": False,
        "production_approved": False,
        "candidate_promoted": False,
        "prohibited_for_training": True,
        "threshold_manifest": thresholds,
    }
    result = build_locked_rc(body, output_path=LOCKED_PATH)
    locked_body = json.loads(LOCKED_PATH.read_text(encoding="utf-8"))
    record = create_lock_record(
        rc_id=RC_ID, locked_path=LOCKED_PATH, locked_body=locked_body, provenance="MAI_07R3N"
    )
    LOCK_RECORD_PATH.write_text(
        json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return {
        "verdict": "LOCKED_NOT_RUN",
        "development": {"ok": True},
        "locked": True,
        "locked_path": str(LOCKED_PATH),
        "resource_content_sha256": pack["content_hash"],
        "rc_manifest_semantic_sha256": result.get("rc_manifest_semantic_sha256"),
    }


def one_shot_holdout() -> dict[str, Any]:
    assert_active_default_immutable()
    if not LOCKED_PATH.is_file():
        return {"verdict": "BLOCKED_PRECONDITION_FAILED", "reason": "missing_lock"}
    if CHAIN_PATH.is_file():
        return {"verdict": "BLOCKED_PRECONDITION_FAILED", "reason": "attempt_already_consumed"}
    _require_write()
    locked = json.loads(LOCKED_PATH.read_text(encoding="utf-8"))
    if locked.get("status") != "LOCKED_NOT_RUN":
        return {"verdict": "BLOCKED_PRECONDITION_FAILED", "reason": "lock_status"}

    attempt = create_attempt(
        attempt_id="MAI_07R3N_HOLDOUT_ATTEMPT_002",
        rc_id=RC_ID,
        lock_semantic_sha256=locked["rc_manifest_semantic_sha256"],
        lock_raw_sha256=locked["rc_manifest_raw_sha256"],
        command="python -m src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n --one-shot",
        split="HOLDOUT_VALIDATION",
    )

    results = {}
    for split in (
        "HOLDOUT_VALIDATION",
        "SAFETY_CHALLENGE",
        "CONTEXT_COUNTERFACTUAL",
        "OOV_CHALLENGE",
        "MONOTONIC_REGRESSION",
    ):
        results[split] = score_split(split, write=True)

    holdout_ok = all(results[s]["ok"] for s in results)
    pred_path = REPORTS / "holdout_validation_predictions.jsonl"
    preds = [json.loads(ln) for ln in pred_path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    bound_attempt = bind_predictions(attempt, pred_path=pred_path, preds=preds)
    attempt_path = OUT / f"{attempt['attempt_id']}.json"
    _write_json(attempt_path, bound_attempt)

    verdict = "PASSED_CORRECTIVE_RC" if holdout_ok else "FAILED_HOLDOUT_QUALITY"
    qual = create_qualification_result(
        rc_id=RC_ID,
        lock_semantic_sha256=locked["rc_manifest_semantic_sha256"],
        gate_all_pass=holdout_ok,
        attempt_id=attempt["attempt_id"],
        metrics_summary=results["HOLDOUT_VALIDATION"]["canonical"].get("metrics", {}),
    )
    # Preserve engineering flags
    qual["QUALITY_GATES_PASSED"] = False
    qual["LINGUIST_APPROVED"] = False
    qual["PRODUCTION_APPROVED"] = False
    qual["candidate_promoted"] = False
    qual["MAI-07"] = "NEEDS_CORRECTIVE_WORK"
    qual["MAI-08"] = "NOT_STARTED"
    qual["engineering_verdict"] = verdict
    qual_path = OUT / f"{RC_ID}.QUALIFICATION_RESULT.json"
    _write_json(qual_path, qual)
    _write_json(
        CHAIN_PATH,
        {
            "rc_id": RC_ID,
            "locked_not_run_path": str(LOCKED_PATH.relative_to(REPO)).replace("\\", "/"),
            "lock_record_path": str(LOCK_RECORD_PATH.relative_to(REPO)).replace("\\", "/"),
            "holdout_attempt_path": str(attempt_path.relative_to(REPO)).replace("\\", "/"),
            "qualification_path": str(qual_path.relative_to(REPO)).replace("\\", "/"),
            "locked_semantic_sha256": locked["rc_manifest_semantic_sha256"],
            "locked_raw_sha256": locked["rc_manifest_raw_sha256"],
            "verdict": verdict,
            "consumed": True,
        },
    )
    imm = {
        "active_runtime": RUNTIME_VERSION,
        "active_runtime_expected": PARENT_RUNTIME_VERSION,
        "active_ok": RUNTIME_VERSION == PARENT_RUNTIME_VERSION,
        "overlay_disabled": ENABLE_PROMOTION_OVERLAY is False,
        "parent_resource_hash": PARENT_RESOURCE_HASH,
        "candidate_runtime": CANDIDATE_RUNTIME_VERSION,
        "candidate_promoted": False,
    }
    _write_json(REPORTS / "IMMUTABILITY_REPORT.json", imm)
    return {"verdict": verdict, "results": {k: {"ok": v["ok"]} for k, v in results.items()}, "immutability": imm}


def main() -> int:
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--score-development", action="store_true")
    p.add_argument("--lock", action="store_true")
    p.add_argument("--one-shot", action="store_true")
    p.add_argument("--write", action="store_true")
    p.add_argument("--check-preflight", action="store_true")
    args = p.parse_args()
    if args.check_preflight:
        assert_active_default_immutable()
        pack = check_pack()
        print(json.dumps({"ok": pack.get("ok"), "pack": pack, "candidate": candidate_identity_card()}, indent=2))
        return 0 if pack.get("ok") else 1
    if args.score_development:
        r = score_split("DEVELOPMENT", write=args.write)
        print(json.dumps({"ok": r["ok"], "failed_gates": r["canonical"].get("failed_gates"), "case_count": r["case_count"]}, indent=2))
        return 0 if r["ok"] else 1
    if args.lock:
        r = lock_rc(write=True)
        print(json.dumps({"verdict": r["verdict"], "locked": r.get("locked")}, indent=2))
        return 0 if r.get("locked") or r["verdict"] == "FAILED_DEVELOPMENT" else 1
    if args.one_shot:
        r = one_shot_holdout()
        print(json.dumps({"verdict": r["verdict"], "results": r.get("results")}, indent=2))
        return 0 if r["verdict"] == "PASSED_CORRECTIVE_RC" else 1
    raise SystemExit("require --check-preflight, --score-development, --lock, or --one-shot")


if __name__ == "__main__":
    raise SystemExit(main())
