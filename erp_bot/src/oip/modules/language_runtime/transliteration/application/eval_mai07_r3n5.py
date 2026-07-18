"""Governed R3N5 lock and one-shot fresh-holdout evaluator."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any

from .build_mai07r3n5_pack import PACK_VERSION, check_existing as check_pack
from .eval_mai07_r3n5_audit_scorer import (
    compare_canonical_audit,
    compare_case_observations,
    observe_case_audit,
    score_observations_audit,
)
from .eval_mai07_r3n5_canonical_scorer import observe_case, score_observations
from .eval_mai07_r3n5_development import REPORT_PATH as DEVELOPMENT_REPORT_PATH, score_development
from .mai07_r3n5_candidate_runtime import (
    CANDIDATE_POLICY_VERSION,
    CANDIDATE_RUNTIME_VERSION,
    PARENT_FAILED_R3N4_ATTEMPT,
    PARENT_FAILED_R3N4_LOCK_SEMANTIC,
    PARENT_FAILED_R3N4_RUNTIME_VERSION,
    PARENT_FAILED_R3N4_VERDICT,
    PARENT_RESOURCE_HASH,
    PARENT_RUNTIME_VERSION,
    assert_active_default_immutable,
    candidate_identity_card,
    transliterate_r3n5,
)
from .mai07_r3n5_dataset_builder import SPLIT_FILES
from .r3n5_scoring_contracts import (
    CONTRACT_VERSION,
    MINIMUM_DENOMINATORS,
    REQUIRED_POPULATIONS,
    SCORER_VERSION,
)
from .rc_lock_chain import (
    bind_predictions,
    build_locked_rc,
    create_attempt,
    create_lock_record,
    create_qualification_result,
    verify_complete_chain,
    verify_locked_rc,
    write_json_immutable,
)
from .. import ENABLE_PROMOTION_OVERLAY, RUNTIME_VERSION
from ..infrastructure.seal_contract_v2 import (
    SEAL_CONTRACT_VERSION,
    semantic_json_hash,
    sha256_file,
)

REPO = Path(__file__).resolve().parents[7]
APP = Path(__file__).resolve().parent
OUT = REPO / "evals" / "mai07_r3n5_fresh_holdout"
REPORTS = OUT / "reports"
MANIFEST_PATH = OUT / "MANIFEST.json"
THRESHOLDS_PATH = OUT / "MAI_07R3N5_THRESHOLDS.json"
RC_ID = "MAI_07R3N5_FRESH_HOLDOUT_RELEASE_CANDIDATE_001"
ATTEMPT_ID = "MAI_07R3N5_HOLDOUT_ATTEMPT_001"
LOCKED_PATH = OUT / f"{RC_ID}.LOCKED_NOT_RUN.json"
LOCK_RECORD_PATH = OUT / f"{RC_ID}.LOCK_RECORD.json"
ATTEMPT_PATH = OUT / f"{ATTEMPT_ID}.json"
QUALIFICATION_PATH = OUT / f"{RC_ID}.QUALIFICATION_RESULT.json"
CHAIN_PATH = OUT / f"{RC_ID}.CHAIN_MANIFEST.json"
AUTHORIZE_LOCK_ENV = "MAI07_AUTHORIZE_R3N5_LOCK"
AUTHORIZE_HOLDOUT_ENV = "MAI07_AUTHORIZE_R3N5_HOLDOUT"

HOLDOUT_SPLITS = (
    "HOLDOUT_VALIDATION",
    "SAFETY_CHALLENGE",
    "CONTEXT_COUNTERFACTUAL",
    "OOV_CHALLENGE",
    "MONOTONIC_REGRESSION",
    "IDENTITY_ANCHOR_CHALLENGE",
)


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _load_split(split: str) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in (OUT / SPLIT_FILES[split]).read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def _source_hashes() -> dict[str, str]:
    names = (
        "eval_mai07_r3n5.py",
        "eval_mai07_r3n5_canonical_scorer.py",
        "eval_mai07_r3n5_audit_scorer.py",
        "mai07_r3n5_candidate_runtime.py",
        "mai07_r3n5_dataset_builder.py",
        "r3n5_target_span_contract.py",
        "r3n5_scoring_contracts.py",
        "build_mai07r3n5_pack.py",
        "r3n4_candidate_finalization.py",
        "r3n4_identity_anchor.py",
        "r3n4_finalization_path_registry.py",
    )
    return {name: sha256_file(APP / name) for name in names}


def _population_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    return dict(Counter(pop for row in rows for pop in row.get("population_ids", [])))


def _validate_manifest() -> dict[str, Any]:
    manifest = _load_json(MANIFEST_PATH)
    errors: list[str] = []
    for split, metadata in manifest.get("splits", {}).items():
        path = OUT / metadata["filename"]
        if not path.is_file() or sha256_file(path) != metadata["sha256"]:
            errors.append(f"split_hash:{split}")
        rows = _load_split(split)
        if len(rows) != int(metadata["count"]):
            errors.append(f"split_count:{split}")
    holdout_counts = _population_counts(_load_split("HOLDOUT_VALIDATION"))
    for population, minimum in MINIMUM_DENOMINATORS.items():
        if population in {"CONTEXT_COUNTERFACTUAL", "OOV", "MONOTONIC_PARENT_CORRECT", "IDENTITY_ANCHOR_CHALLENGE"}:
            continue
        if holdout_counts.get(population, 0) < minimum:
            errors.append(f"population_floor:{population}")
    support_map = {
        "CONTEXT_COUNTERFACTUAL": "CONTEXT_COUNTERFACTUAL",
        "OOV_CHALLENGE": "OOV",
        "MONOTONIC_REGRESSION": "MONOTONIC_PARENT_CORRECT",
        "IDENTITY_ANCHOR_CHALLENGE": "IDENTITY_ANCHOR_CHALLENGE",
    }
    for split, population in support_map.items():
        if _population_counts(_load_split(split)).get(population, 0) < MINIMUM_DENOMINATORS[population]:
            errors.append(f"support_floor:{split}:{population}")
    return {"ok": not errors, "errors": errors, "manifest": manifest}


def _parent_r3n4_lineage() -> dict[str, Any]:
    chain_path = REPO / "evals/mai07_r3n4_fresh_holdout/MAI_07R3N4_FRESH_HOLDOUT_RELEASE_CANDIDATE_001.CHAIN_MANIFEST.json"
    chain = _load_json(chain_path)
    ok = bool(
        chain.get("consumed") is True
        and chain.get("verdict") == PARENT_FAILED_R3N4_VERDICT
        and chain.get("locked_semantic_sha256") == PARENT_FAILED_R3N4_LOCK_SEMANTIC
    )
    return {
        "ok": ok,
        "runtime_version": PARENT_FAILED_R3N4_RUNTIME_VERSION,
        "attempt_id": PARENT_FAILED_R3N4_ATTEMPT,
        "lock_semantic_sha256": PARENT_FAILED_R3N4_LOCK_SEMANTIC,
        "verdict": PARENT_FAILED_R3N4_VERDICT,
        "consumed": chain.get("consumed"),
        "candidate_promoted": False,
        "chain_path": str(chain_path.relative_to(REPO)).replace("\\", "/"),
    }


def preflight() -> dict[str, Any]:
    assert_active_default_immutable()
    pack = check_pack()
    dataset = _validate_manifest()
    parent = _parent_r3n4_lineage()
    thresholds = _load_json(THRESHOLDS_PATH)
    threshold_minima_ok = thresholds.get("minimum_denominators") == MINIMUM_DENOMINATORS
    threshold_lock_ok = thresholds.get("locked_before_holdout") is True
    development = score_development(write=False)
    no_holdout_artifacts = not any(
        path.exists() for path in (ATTEMPT_PATH, QUALIFICATION_PATH, CHAIN_PATH)
    )
    return {
        "ok": bool(
            pack.get("ok") and dataset["ok"] and parent["ok"] and threshold_minima_ok
            and threshold_lock_ok and development.get("ok") and no_holdout_artifacts
            and RUNTIME_VERSION == PARENT_RUNTIME_VERSION and ENABLE_PROMOTION_OVERLAY is False
        ),
        "pack": pack,
        "dataset": {"ok": dataset["ok"], "errors": dataset["errors"]},
        "parent_r3n4": parent,
        "threshold_minima_ok": threshold_minima_ok,
        "threshold_lock_ok": threshold_lock_ok,
        "development_ok": development.get("ok"),
        "canonical_audit_agreement": development.get("agreement"),
        "case_agreement": development.get("case_agreement"),
        "no_holdout_artifacts": no_holdout_artifacts,
    }


def _locked_body() -> dict[str, Any]:
    manifest = _load_json(MANIFEST_PATH)
    thresholds = _load_json(THRESHOLDS_PATH)
    development = _load_json(DEVELOPMENT_REPORT_PATH)
    pack = check_pack()
    source_hashes = _source_hashes()
    population_payload = {
        "required_populations": list(REQUIRED_POPULATIONS),
        "minimum_denominators": MINIMUM_DENOMINATORS,
    }
    return {
        "schema_version": "2.0.0",
        "manifest_id": RC_ID,
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "ENABLE_PROMOTION_OVERLAY": False,
        "overlay_enabled": False,
        "default_active": False,
        "candidate_promoted": False,
        "active_default_runtime_unchanged": PARENT_RUNTIME_VERSION,
        "active_default_resource_hash": PARENT_RESOURCE_HASH,
        "candidate_runtime_version": CANDIDATE_RUNTIME_VERSION,
        "candidate_policy_version": CANDIDATE_POLICY_VERSION,
        "candidate_resource_pack_version": PACK_VERSION,
        "candidate_resource_content_sha256": pack["content_hash"],
        "correction_scope": "TARGET_SPAN_AND_EVALUATION_PATH_AUTHORITY",
        "parent_failed_r3n4_lineage": _parent_r3n4_lineage(),
        "target_authority": {
            "schema_version": "mai07_r3n5_target_span_v1",
            "offset_unit": "UNICODE_CODE_POINT",
            "source_sha256": source_hashes["r3n5_target_span_contract.py"],
        },
        "dataset_manifest": manifest,
        "dataset_manifest_sha256": sha256_file(MANIFEST_PATH),
        "threshold_manifest": thresholds,
        "threshold_manifest_sha256": sha256_file(THRESHOLDS_PATH),
        "population_definition_hash": hashlib.sha256(
            json.dumps(population_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest(),
        "minimum_denominator_policy": MINIMUM_DENOMINATORS,
        "scorer_version": SCORER_VERSION,
        "scoring_contract_version": CONTRACT_VERSION,
        "source_hashes": source_hashes,
        "development_report_raw_sha256": sha256_file(DEVELOPMENT_REPORT_PATH),
        "development_report_semantic_sha256": semantic_json_hash(development),
        "development_all_required_pass": development.get("ok") is True,
        "development_canonical_audit_agreement": development.get("agreement", {}).get("ok") is True,
        "development_case_agreement": development.get("case_agreement", {}).get("ok") is True,
        "holdout_not_run": True,
        "parent_prediction_jsonl_opened": False,
        "prohibited_for_training": True,
        "quality_gates_passed": False,
        "linguist_approved": False,
        "production_approved": False,
        "MAI-07": "NEEDS_CORRECTIVE_WORK",
        "MAI-08": "NOT_STARTED",
    }


def lock_rc() -> dict[str, Any]:
    if os.environ.get(AUTHORIZE_LOCK_ENV) != "1":
        raise PermissionError(f"Set {AUTHORIZE_LOCK_ENV}=1 to create immutable R3N5 lock")
    if LOCKED_PATH.exists() or LOCK_RECORD_PATH.exists():
        raise FileExistsError("r3n5_lock_already_exists")
    # Recreate current development evidence immediately before source hashing.
    os.environ["MAI07_AUTHORIZE_R3N5_DEVELOPMENT_WRITE"] = "1"
    development = score_development(write=True)
    if not development.get("ok"):
        return {"ok": False, "verdict": "FAILED_DEVELOPMENT"}
    ready = preflight()
    if not ready["ok"]:
        return {"ok": False, "verdict": "BLOCKED_PREFLIGHT", "preflight": ready}
    body = _locked_body()
    with tempfile.TemporaryDirectory(prefix="mai07_r3n5_lock_dry_") as temporary:
        dry_path = Path(temporary) / "LOCKED_NOT_RUN.json"
        build_locked_rc(body, output_path=dry_path)
        dry_body = _load_json(dry_path)
        verification = verify_locked_rc(dry_body)
        if not verification["ok"]:
            return {"ok": False, "verdict": "INVALID_DRY_LOCK", "verification": verification}
    result = build_locked_rc(body, output_path=LOCKED_PATH)
    locked_body = _load_json(LOCKED_PATH)
    final_verification = verify_locked_rc(locked_body)
    if not final_verification["ok"]:
        raise RuntimeError(f"immutable_lock_verification_failed:{final_verification['errors']}")
    record = create_lock_record(
        rc_id=RC_ID,
        locked_path=LOCKED_PATH,
        locked_body=locked_body,
        parent_lock_semantic=PARENT_FAILED_R3N4_LOCK_SEMANTIC,
        provenance="MAI_07R3N5_APPEND_ONLY_LOCK_CHAIN",
    )
    write_json_immutable(LOCK_RECORD_PATH, record)
    return {
        "ok": True,
        "verdict": "LOCKED_NOT_RUN",
        "semantic_sha256": result["rc_manifest_semantic_sha256"],
        "physical_raw_sha256": sha256_file(LOCKED_PATH),
    }


def _score_split_once(split: str) -> dict[str, Any]:
    cases = _load_split(split)
    thresholds = _load_json(THRESHOLDS_PATH)
    bundles = [transliterate_r3n5(case["input_text"]) for case in cases]
    canonical_obs = [observe_case(case, bundle) for case, bundle in zip(cases, bundles, strict=True)]
    audit_obs = [observe_case_audit(case, bundle) for case, bundle in zip(cases, bundles, strict=True)]
    canonical = score_observations(cases, canonical_obs, thresholds=thresholds, split=split)
    audit = score_observations_audit(cases, audit_obs, thresholds=thresholds, split=split)
    aggregate_agreement = compare_canonical_audit(canonical, audit)
    case_agreement = compare_case_observations(canonical_obs, audit_obs)
    expected = canonical.get("metrics", {}).get("split_expected_pass", {})
    expected_pass = bool(expected.get("denominator") == len(cases) and expected.get("numerator") == len(cases))
    ok = bool(canonical.get("ok") and audit.get("ok") and aggregate_agreement["ok"] and case_agreement["ok"] and expected_pass)
    predictions = [
        {
            "case_id": obs["case_id"],
            "span_found": obs["span_found"],
            "identity_top1": obs["identity_top1"],
            "identity_retained": obs["identity_retained"],
            "exact_raw_identity": obs["exact_raw_identity"],
            "exactly_one_identity": obs["exactly_one_identity"],
            "finalizer_idempotence": obs["finalizer_idempotence"],
            "serialization_roundtrip": obs["serialization_roundtrip"],
            "path_finalized": obs["path_finalized"],
            "anchor_valid": obs["anchor_valid"],
            "runtime": CANDIDATE_RUNTIME_VERSION,
        }
        for obs in canonical_obs
    ]
    return {
        "ok": ok,
        "case_count": len(cases),
        "canonical": canonical,
        "audit": audit,
        "agreement": aggregate_agreement,
        "case_agreement": case_agreement,
        "split_expected_pass": expected_pass,
        "predictions": predictions,
    }


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(json.dumps(row, sort_keys=True, separators=(",", ":")) + "\n" for row in rows),
        encoding="utf-8",
        newline="\n",
    )


def one_shot_holdout() -> dict[str, Any]:
    if os.environ.get(AUTHORIZE_HOLDOUT_ENV) != "1":
        raise PermissionError(f"Set {AUTHORIZE_HOLDOUT_ENV}=1 to execute the one-shot holdout")
    if not LOCKED_PATH.is_file():
        return {"verdict": "BLOCKED_PRECONDITION_FAILED", "reason": "missing_lock"}
    if any(path.exists() for path in (ATTEMPT_PATH, QUALIFICATION_PATH, CHAIN_PATH)):
        return {"verdict": "BLOCKED_PRECONDITION_FAILED", "reason": "attempt_already_consumed"}
    locked = _load_json(LOCKED_PATH)
    lock_semantic = locked["rc_manifest_semantic_sha256"]
    physical_raw = sha256_file(LOCKED_PATH)
    attempt = create_attempt(
        attempt_id=ATTEMPT_ID,
        rc_id=RC_ID,
        lock_semantic_sha256=lock_semantic,
        lock_raw_sha256=physical_raw,
        command="python -m erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n5 --one-shot",
        split="HOLDOUT_VALIDATION",
    )
    results: dict[str, Any] = {}
    for split in HOLDOUT_SPLITS:
        result = _score_split_once(split)
        prediction_path = REPORTS / f"{split.lower()}_predictions.jsonl"
        report_path = REPORTS / f"{split.lower()}_score_report.json"
        _write_jsonl(prediction_path, result.pop("predictions"))
        write_json_immutable(report_path, result)
        results[split] = result
    holdout_ok = all(result["ok"] for result in results.values())
    holdout_predictions_path = REPORTS / "holdout_validation_predictions.jsonl"
    holdout_predictions = [
        json.loads(line)
        for line in holdout_predictions_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    bound_attempt = bind_predictions(attempt, pred_path=holdout_predictions_path, preds=holdout_predictions)
    write_json_immutable(ATTEMPT_PATH, bound_attempt)
    verdict = "PASSED_FRESH_HOLDOUT_CORRECTIVE_RC" if holdout_ok else "FAILED_HOLDOUT_QUALITY"
    qualification = create_qualification_result(
        rc_id=RC_ID,
        lock_semantic_sha256=lock_semantic,
        gate_all_pass=holdout_ok,
        attempt_id=ATTEMPT_ID,
        metrics_summary=results["HOLDOUT_VALIDATION"]["canonical"]["metrics"],
    )
    qualification.update(
        {
            "status": verdict,
            "engineering_verdict": verdict,
            "candidate_promoted": False,
            "MAI-07": "NEEDS_CORRECTIVE_WORK",
            "MAI-08": "NOT_STARTED",
        }
    )
    write_json_immutable(QUALIFICATION_PATH, qualification)
    chain = {
        "rc_id": RC_ID,
        "locked_not_run_path": str(LOCKED_PATH.relative_to(REPO)).replace("\\", "/"),
        "lock_record_path": str(LOCK_RECORD_PATH.relative_to(REPO)).replace("\\", "/"),
        "holdout_attempt_path": str(ATTEMPT_PATH.relative_to(REPO)).replace("\\", "/"),
        "qualification_path": str(QUALIFICATION_PATH.relative_to(REPO)).replace("\\", "/"),
        "locked_semantic_sha256": lock_semantic,
        "locked_raw_sha256": physical_raw,
        "verdict": verdict,
        "consumed": True,
    }
    write_json_immutable(CHAIN_PATH, chain)
    chain_verification = verify_complete_chain(chain, REPO)
    if not chain_verification["ok"]:
        raise RuntimeError(f"chain_verification_failed:{chain_verification['errors']}")
    return {"verdict": verdict, "results": {split: result["ok"] for split, result in results.items()}, "chain_verified": True}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--lock", action="store_true")
    parser.add_argument("--one-shot", action="store_true")
    args = parser.parse_args()
    if args.preflight:
        result = preflight()
    elif args.lock:
        result = lock_rc()
    elif args.one_shot:
        result = one_shot_holdout()
    else:
        raise SystemExit("require --preflight, --lock, or --one-shot")
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result.get("ok", result.get("verdict") == "PASSED_FRESH_HOLDOUT_CORRECTIVE_RC") else 1


if __name__ == "__main__":
    raise SystemExit(main())
