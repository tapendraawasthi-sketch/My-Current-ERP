"""MAI-07R3N2 fresh-holdout policy-conformance corrective evaluation runner.

Uses the R3N2 sealed pack explicitly via load_r3n2_resources / transliterate_r3n2.
Never mutates ACTIVE_PACK_VERSION or enables the overlay.
"""

from __future__ import annotations

import hashlib
import json
import os
from collections import defaultdict
from pathlib import Path
from typing import Any

from .build_mai07r3n2_pack import PACK_VERSION, check_existing as check_pack
from .eval_mai07_r3n2_audit_scorer import compare_canonical_audit, observe_case_audit, score_observations_audit
from .eval_mai07_r3n2_canonical_scorer import observe_case, score_observations
from .mai07_r3n2_candidate_runtime import (
    CANDIDATE_POLICY_VERSION,
    CANDIDATE_RUNTIME_VERSION,
    INVALIDATED_R3N_PACK_HASH,
    INVALIDATED_R3N_RUNTIME_VERSION,
    PARENT_RESOURCE_HASH,
    PARENT_RUNTIME_VERSION,
    R3M_CLOSURE_SEMANTIC,
    R3N_INTEGRITY_CLOSURE_SEMANTIC,
    assert_active_default_immutable,
    candidate_identity_card,
    load_r3n2_resources,
    transliterate_r3n2,
)
from .rc_lock_chain import (
    bind_predictions,
    build_locked_rc,
    create_attempt,
    create_lock_record,
    create_qualification_result,
)
from .r3n2_scoring_contracts import (
    CONTRACT_VERSION,
    MINIMUM_DENOMINATORS,
    REQUIRED_POPULATIONS,
    SCORER_VERSION,
    check_population_minima,
)
from .transliteration_service import transliterate_frame
from ...application.language_analyzer import analyze_language
from ...normalization.application.normalization_service import attach_normalization_to_frame
from .. import ENABLE_PROMOTION_OVERLAY, RUNTIME_VERSION
from ..infrastructure.resource_repository import load_resources
from ..infrastructure.seal_contract_v2 import SEAL_CONTRACT_VERSION, predictions_canonical_list_sha256, sha256_file

REPO = Path(__file__).resolve().parents[7]
APP = Path(__file__).resolve().parent
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
OUT = REPO / "evals" / "mai07_r3n2_fresh_holdout"
REPORTS = OUT / "reports"
RC_ID = "MAI_07R3N2_FRESH_HOLDOUT_RELEASE_CANDIDATE_001"
ATTEMPT_ID = "MAI_07R3N2_HOLDOUT_ATTEMPT_001"
LOCKED_PATH = OUT / f"{RC_ID}.LOCKED_NOT_RUN.json"
LOCK_RECORD_PATH = OUT / f"{RC_ID}.LOCK_RECORD.json"
CHAIN_PATH = OUT / f"{RC_ID}.CHAIN_MANIFEST.json"
THRESHOLDS_PATH = OUT / "MAI_07R3N2_THRESHOLDS.json"
POLICY_CONFIG_PATH = XL / "resources" / "r3n2_fresh_holdout_policy.json"
R3N_CLOSURE_DIR = REPO / "evals" / "mai07_r3n_integrity_closure"
R3N_INVALIDATION_SIDECAR_PATHS = (
    R3N_CLOSURE_DIR / "HISTORICAL_INVALIDATION_SIDECAR.json",
    REPO
    / "evals/mai07_r3n_policy_conformance/MAI_07R3N_POLICY_CONFORMANCE_RELEASE_CANDIDATE_002.HISTORICAL_INVALIDATION_SIDECAR.json",
)
INVALIDATED_PARENT_REASON = "INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED"
AUTHORIZE_ENV = "MAI07_AUTHORIZE_EVAL_WRITE"

SPLIT_FILES = {
    "DEVELOPMENT": "development.jsonl",
    "HOLDOUT_VALIDATION": "holdout_validation.jsonl",
    "SAFETY_CHALLENGE": "safety_challenge.jsonl",
    "CONTEXT_COUNTERFACTUAL": "context_counterfactual.jsonl",
    "OOV_CHALLENGE": "oov_challenge.jsonl",
    "MONOTONIC_REGRESSION": "monotonic_regression.jsonl",
}

PARENT_COMPARISON_SPLITS = frozenset({"HOLDOUT_VALIDATION", "MONOTONIC_REGRESSION"})


def _require_write() -> None:
    if os.environ.get(AUTHORIZE_ENV) != "1":
        raise PermissionError(f"Set {AUTHORIZE_ENV}=1 to authorize R3N2 evaluation writes")


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


def _population_counts(cases: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for case in cases:
        for pid in case.get("populations") or case.get("population_ids") or []:
            counts[pid] += 1
    return dict(counts)


def _population_definition_hash() -> str:
    payload = {
        "required_populations": list(REQUIRED_POPULATIONS),
        "minimum_denominators": dict(MINIMUM_DENOMINATORS),
    }
    body = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _source_hashes() -> dict[str, str]:
    return {
        "scorer_canonical_source_sha256": sha256_file(APP / "eval_mai07_r3n2_canonical_scorer.py"),
        "scorer_audit_source_sha256": sha256_file(APP / "eval_mai07_r3n2_audit_scorer.py"),
        "scoring_contract_sha256": sha256_file(APP / "r3n2_scoring_contracts.py"),
        "evaluator_source_sha256": sha256_file(Path(__file__)),
        "policy_config_sha256": sha256_file(POLICY_CONFIG_PATH),
        "runtime_semantic_hash": sha256_file(APP / "mai07_r3n2_candidate_runtime.py"),
    }


def _verify_r3n_integrity_closure() -> dict[str, Any]:
    semantic_path = R3N_CLOSURE_DIR / "SEMANTIC_HASH.json"
    if not semantic_path.is_file():
        return {"ok": False, "error": "missing_r3n_integrity_semantic_file", "path": str(semantic_path)}
    semantic = json.loads(semantic_path.read_text(encoding="utf-8"))
    observed = semantic.get("semantic_sha256")
    if observed != R3N_INTEGRITY_CLOSURE_SEMANTIC:
        return {
            "ok": False,
            "error": "r3n_integrity_semantic_mismatch",
            "expected": R3N_INTEGRITY_CLOSURE_SEMANTIC,
            "observed": observed,
        }
    sidecar_path = next((p for p in R3N_INVALIDATION_SIDECAR_PATHS if p.is_file()), None)
    if sidecar_path is None:
        return {"ok": False, "error": "missing_r3n_invalidation_sidecar"}
    return {
        "ok": True,
        "semantic_path": str(semantic_path),
        "semantic_sha256": observed,
        "invalidation_sidecar_path": str(sidecar_path),
    }


def _transliterate_parent(raw_text: str, *, resources: Any) -> Any:
    frame = attach_normalization_to_frame(analyze_language(raw_text))
    return transliterate_frame(frame, resources=resources, use_context=True)


def _prediction_row(case: dict[str, Any], obs: dict[str, Any], *, runtime: str) -> dict[str, Any]:
    return {
        "case_id": case["case_id"],
        "span_found": obs["span_found"],
        "identity_top1": obs["identity_top1"],
        "identity_retained": obs["identity_retained"],
        "false_devanagari_top1": obs["false_devanagari_top1"],
        "devanagari_at_5": obs["devanagari_at_5"],
        "caps_ok": obs["caps_ok"],
        "candidate_count": obs["candidate_count"],
        "runtime": runtime,
    }


def _compute_parent_differential(
    cases: list[dict[str, Any]], observations: list[dict[str, Any]]
) -> dict[str, Any]:
    improved = 0
    regressed = 0
    unchanged = 0
    monotonic_harm = 0
    monotonic_fix = 0
    comparable = 0
    for case, obs in zip(cases, observations, strict=True):
        parent_id_top1 = obs.get("parent_identity_top1")
        if parent_id_top1 is None:
            continue
        comparable += 1
        cand_id_top1 = bool(obs["identity_top1"])
        if cand_id_top1 and not parent_id_top1:
            improved += 1
        elif parent_id_top1 and not cand_id_top1:
            regressed += 1
        else:
            unchanged += 1
        pops = case.get("populations") or case.get("population_ids") or []
        if "MONOTONIC_PARENT_CORRECT" in pops and parent_id_top1 and not cand_id_top1:
            monotonic_harm += 1
        if "MONOTONIC_PARENT_INCORRECT" in pops and cand_id_top1 and not parent_id_top1:
            monotonic_fix += 1
    return {
        "comparable_cases": comparable,
        "candidate_improved_identity_top1": improved,
        "candidate_regressed_identity_top1": regressed,
        "unchanged_identity_top1": unchanged,
        "monotonic_parent_correct_harm": monotonic_harm,
        "monotonic_parent_incorrect_fix": monotonic_fix,
    }


def run_predictions(cases: list[dict[str, Any]], *, use_r3n2: bool = True) -> list[dict[str, Any]]:
    assert_active_default_immutable()
    rows: list[dict[str, Any]] = []
    res = load_r3n2_resources() if use_r3n2 else load_resources()
    for case in cases:
        if use_r3n2:
            bundle = transliterate_r3n2(case["input_text"], resources=res)
        else:
            bundle = _transliterate_parent(case["input_text"], resources=res)
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
                "runtime": CANDIDATE_RUNTIME_VERSION if use_r3n2 else PARENT_RUNTIME_VERSION,
                "span_found": span is not None,
                "eligibility": getattr(getattr(span, "eligibility", None), "value", None) if span else None,
                "candidates": cands,
                "bundle_ref": id(bundle),
            }
        )
    return rows


def score_split(
    split: str,
    *,
    write: bool = False,
    include_parent: bool = False,
) -> dict[str, Any]:
    assert_active_default_immutable()
    cases = load_split(split)
    thresholds = load_thresholds()
    candidate_res = load_r3n2_resources()
    parent_res = load_resources() if include_parent and split in PARENT_COMPARISON_SPLITS else None
    observations = []
    audit_obs = []
    bundles: dict[str, Any] = {}
    for case in cases:
        bundle = transliterate_r3n2(case["input_text"], resources=candidate_res)
        bundles[case["case_id"]] = bundle
        parent_bundle = None
        if parent_res is not None:
            parent_bundle = _transliterate_parent(case["input_text"], resources=parent_res)
        observations.append(observe_case(case, bundle, parent_bundle=parent_bundle))
        audit_obs.append(observe_case_audit(case, bundle))

    for case in cases:
        b2 = transliterate_r3n2(case["input_text"], resources=candidate_res)
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

    raw_mut = sum(1 for o in observations if not o["raw_text_unchanged"])
    if raw_mut != 0:
        canonical["ok"] = False
        canonical["failed_gates"] = list(canonical.get("failed_gates") or []) + ["raw_mutation_count"]

    differential = None
    if parent_res is not None:
        differential = _compute_parent_differential(cases, observations)

    result: dict[str, Any] = {
        "split": split,
        "case_count": len(cases),
        "canonical": canonical,
        "audit": audit,
        "agreement": agreement,
        "candidate": candidate_identity_card(),
        "active_runtime": RUNTIME_VERSION,
        "overlay_enabled": ENABLE_PROMOTION_OVERLAY,
        "include_parent": parent_res is not None,
        "ok": canonical["ok"] and agreement["ok"],
    }
    if differential is not None:
        result["parent_candidate_differential"] = differential

    if write:
        _require_write()
        REPORTS.mkdir(parents=True, exist_ok=True)
        pred_path = REPORTS / f"{split.lower()}_predictions.jsonl"
        pred_rows = [
            _prediction_row(case, obs, runtime=CANDIDATE_RUNTIME_VERSION)
            for case, obs in zip(cases, observations, strict=True)
        ]
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


def score_development(*, write: bool = False) -> dict[str, Any]:
    """Score DEVELOPMENT only. Failure yields FAILED_DEVELOPMENT."""
    result = score_split("DEVELOPMENT", write=write, include_parent=False)
    if not result["ok"]:
        return {
            "verdict": "FAILED_DEVELOPMENT",
            "ok": False,
            "development": result,
            "failed_gates": result["canonical"].get("failed_gates"),
        }
    return {
        "verdict": "PASSED_DEVELOPMENT",
        "ok": True,
        "development": result,
    }


def preflight_population_gate() -> dict[str, Any]:
    """Count holdout/supporting populations and enforce locked minima before holdout."""
    failures: list[dict[str, Any]] = []
    checks: dict[str, Any] = {}

    holdout_cases = load_split("HOLDOUT_VALIDATION")
    holdout_counts = _population_counts(holdout_cases)
    holdout_check = check_population_minima(holdout_counts, split="HOLDOUT_VALIDATION")
    checks["HOLDOUT_VALIDATION"] = holdout_check
    if not holdout_check["ok"]:
        failures.extend(holdout_check.get("failures") or [])

    for split in ("CONTEXT_COUNTERFACTUAL", "OOV_CHALLENGE", "MONOTONIC_REGRESSION"):
        cases = load_split(split)
        counts = _population_counts(cases)
        check = check_population_minima(counts, split=split)
        checks[split] = check
        if not check["ok"]:
            failures.extend(check.get("failures") or [])

    ok = not failures
    return {
        "ok": ok,
        "verdict": None if ok else "BLOCKED_INSUFFICIENT_POPULATION",
        "population_counts": {
            "HOLDOUT_VALIDATION": holdout_counts,
            **{
                split: _population_counts(load_split(split))
                for split in ("CONTEXT_COUNTERFACTUAL", "OOV_CHALLENGE", "MONOTONIC_REGRESSION")
            },
        },
        "checks": checks,
        "failures": failures,
    }


def lock_rc(*, write: bool = True) -> dict[str, Any]:
    """Lock RC only after DEVELOPMENT passes and population minima are satisfied."""
    assert_active_default_immutable()
    integrity = _verify_r3n_integrity_closure()
    if not integrity["ok"]:
        raise RuntimeError(f"BLOCKED_PRECONDITION_FAILED:r3n_integrity:{integrity}")

    pack = check_pack()
    if not pack.get("ok"):
        raise RuntimeError(f"BLOCKED_PRECONDITION_FAILED:pack:{pack}")

    dev = score_development(write=write)
    if not dev["ok"]:
        return {
            "verdict": "FAILED_DEVELOPMENT",
            "development": {"ok": False, "failed_gates": dev.get("failed_gates")},
            "locked": False,
        }

    pop = preflight_population_gate()
    if not pop["ok"]:
        return {
            "verdict": "BLOCKED_INSUFFICIENT_POPULATION",
            "population_gate": pop,
            "locked": False,
        }

    if not write:
        return {
            "verdict": "READY_TO_LOCK",
            "development": {"ok": True},
            "population_gate": {"ok": True},
            "locked": False,
        }

    _require_write()
    thresholds = load_thresholds()
    thr_hash = sha256_file(THRESHOLDS_PATH)
    manifest_path = OUT / "MANIFEST.json"
    dataset_manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.is_file() else {}
    dev_result = dev["development"]
    hashes = _source_hashes()
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
        "scorer_version": SCORER_VERSION,
        "scoring_contract_version": CONTRACT_VERSION,
        "population_definition_hash": _population_definition_hash(),
        "minimum_denominator_policy": dict(MINIMUM_DENOMINATORS),
        "invalidated_parent_lineage": {
            "runtime_version": INVALIDATED_R3N_RUNTIME_VERSION,
            "pack_hash": INVALIDATED_R3N_PACK_HASH,
            "reason": INVALIDATED_PARENT_REASON,
        },
        "r3m_closure_semantic": R3M_CLOSURE_SEMANTIC,
        "r3n_integrity_closure_semantic": R3N_INTEGRITY_CLOSURE_SEMANTIC,
        "development_score_all_required_pass": True,
        "development_predictions_raw_sha256": dev_result.get("predictions_raw_sha256"),
        "development_predictions_canonical_list_sha256": dev_result.get("predictions_canonical_list_sha256"),
        "no_frozen_v2_run": True,
        "no_frozen_prediction_use": True,
        "quality_gates_passed": False,
        "linguist_approved": False,
        "production_approved": False,
        "candidate_promoted": False,
        "prohibited_for_training": True,
        "threshold_manifest": thresholds,
        **hashes,
    }
    result = build_locked_rc(body, output_path=LOCKED_PATH)
    locked_body = json.loads(LOCKED_PATH.read_text(encoding="utf-8"))
    record = create_lock_record(
        rc_id=RC_ID, locked_path=LOCKED_PATH, locked_body=locked_body, provenance="MAI_07R3N2"
    )
    LOCK_RECORD_PATH.write_text(
        json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return {
        "verdict": "LOCKED_NOT_RUN",
        "development": {"ok": True},
        "population_gate": {"ok": True},
        "locked": True,
        "locked_path": str(LOCKED_PATH),
        "resource_content_sha256": pack["content_hash"],
        "rc_manifest_semantic_sha256": result.get("rc_manifest_semantic_sha256"),
    }


def _write_parent_holdout_predictions() -> str:
    cases = load_split("HOLDOUT_VALIDATION")
    parent_res = load_resources()
    rows: list[dict[str, Any]] = []
    for case in cases:
        bundle = _transliterate_parent(case["input_text"], resources=parent_res)
        obs = observe_case(case, bundle)
        rows.append(_prediction_row(case, obs, runtime=PARENT_RUNTIME_VERSION))
    return _write_jsonl(REPORTS / "parent_holdout_predictions.jsonl", rows)


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
        attempt_id=ATTEMPT_ID,
        rc_id=RC_ID,
        lock_semantic_sha256=locked["rc_manifest_semantic_sha256"],
        lock_raw_sha256=locked["rc_manifest_raw_sha256"],
        command="python -m src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n2 --one-shot",
        split="HOLDOUT_VALIDATION",
    )

    REPORTS.mkdir(parents=True, exist_ok=True)
    parent_holdout_sha = _write_parent_holdout_predictions()

    results = {}
    for split in (
        "HOLDOUT_VALIDATION",
        "SAFETY_CHALLENGE",
        "CONTEXT_COUNTERFACTUAL",
        "OOV_CHALLENGE",
        "MONOTONIC_REGRESSION",
    ):
        include_parent = split in PARENT_COMPARISON_SPLITS
        results[split] = score_split(split, write=True, include_parent=include_parent)

    holdout_ok = all(results[s]["ok"] for s in results)
    pred_path = REPORTS / "holdout_validation_predictions.jsonl"
    preds = [json.loads(ln) for ln in pred_path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    bound_attempt = bind_predictions(attempt, pred_path=pred_path, preds=preds)
    attempt_path = OUT / f"{attempt['attempt_id']}.json"
    _write_json(attempt_path, bound_attempt)

    verdict = "PASSED_FRESH_HOLDOUT_CORRECTIVE_RC" if holdout_ok else "FAILED_HOLDOUT_QUALITY"
    qual = create_qualification_result(
        rc_id=RC_ID,
        lock_semantic_sha256=locked["rc_manifest_semantic_sha256"],
        gate_all_pass=holdout_ok,
        attempt_id=attempt["attempt_id"],
        metrics_summary=results["HOLDOUT_VALIDATION"]["canonical"].get("metrics", {}),
    )
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
            "parent_holdout_predictions_path": str(
                (REPORTS / "parent_holdout_predictions.jsonl").relative_to(REPO)
            ).replace("\\", "/"),
            "parent_holdout_predictions_sha256": parent_holdout_sha,
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
        "invalidated_parent_runtime_version": INVALIDATED_R3N_RUNTIME_VERSION,
        "r3n_integrity_closure_semantic": R3N_INTEGRITY_CLOSURE_SEMANTIC,
    }
    _write_json(REPORTS / "IMMUTABILITY_REPORT.json", imm)
    return {
        "verdict": verdict,
        "results": {k: {"ok": v["ok"]} for k, v in results.items()},
        "immutability": imm,
        "parent_holdout_predictions_sha256": parent_holdout_sha,
    }


def main() -> int:
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--check-preflight", action="store_true")
    p.add_argument("--score-development", action="store_true")
    p.add_argument("--lock", action="store_true")
    p.add_argument("--one-shot", action="store_true")
    p.add_argument("--write", action="store_true")
    args = p.parse_args()

    if args.check_preflight:
        assert_active_default_immutable()
        pack = check_pack()
        integrity = _verify_r3n_integrity_closure()
        pop: dict[str, Any] | None = None
        pop_error: str | None = None
        if (OUT / SPLIT_FILES["HOLDOUT_VALIDATION"]).is_file():
            try:
                pop = preflight_population_gate()
            except FileNotFoundError as exc:
                pop_error = str(exc)
        payload = {
            "ok": bool(pack.get("ok")) and integrity["ok"] and (pop is None or pop.get("ok")),
            "pack": pack,
            "integrity_closure": integrity,
            "population_gate": pop,
            "population_gate_error": pop_error,
            "candidate": candidate_identity_card(),
            "source_hashes": _source_hashes(),
        }
        print(json.dumps(payload, indent=2))
        return 0 if payload["ok"] else 1

    if args.score_development:
        r = score_development(write=args.write)
        dev = r.get("development") or {}
        print(
            json.dumps(
                {
                    "verdict": r.get("verdict"),
                    "ok": r.get("ok"),
                    "failed_gates": dev.get("canonical", {}).get("failed_gates"),
                    "case_count": dev.get("case_count"),
                },
                indent=2,
            )
        )
        return 0 if r.get("ok") else 1

    if args.lock:
        r = lock_rc(write=True)
        print(json.dumps({"verdict": r["verdict"], "locked": r.get("locked")}, indent=2))
        return (
            0
            if r.get("locked")
            or r["verdict"] in {"FAILED_DEVELOPMENT", "BLOCKED_INSUFFICIENT_POPULATION"}
            else 1
        )

    if args.one_shot:
        r = one_shot_holdout()
        print(json.dumps({"verdict": r["verdict"], "results": r.get("results")}, indent=2))
        return 0 if r["verdict"] == "PASSED_FRESH_HOLDOUT_CORRECTIVE_RC" else 1

    raise SystemExit("require --check-preflight, --score-development, --lock, or --one-shot")


if __name__ == "__main__":
    raise SystemExit(main())
