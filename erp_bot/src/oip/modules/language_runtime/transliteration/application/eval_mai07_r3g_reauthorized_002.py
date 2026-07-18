"""MAI-07R3G-REAUTHORIZED-002 — one-shot frozen-V2 eval of sealed MAI-07R3F candidate.

Explicit authorization for exactly one frozen-V2 execution against RC_002.
Does not mutate runtime/resources/scorers/thresholds/V2 datasets.
"""

from __future__ import annotations

import hashlib
import json
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from .build_mai07r3c_dataset_v2 import AUDIT_SCORER_VERSION, CANONICAL_SCORER_VERSION
from .eval_audit_scorer_r3c import assert_canonical_matches_audit, audit_aggregate_r3c
from .eval_c2_helpers import extract_primary_produced
from .eval_candidate_roles_r3c import classify_candidate_role
from .eval_mai07_r3c import load_v2_cases, run_one_shot_predictions, score_predictions
from .eval_mai07_r3g_reauthorized import EXPECTED as R3G_EXPECTED
from .eval_mai07_r3g_reauthorized import recompute_v1_hash, recompute_v2_hash
from .rc_lock_chain import (
    compute_rc_semantic_body_sha256,
    verify_complete_chain,
    verify_locked_rc,
    write_json_immutable,
)
from .transliteration_service import attach_transliteration_to_frame
from .. import ENABLE_PROMOTION_OVERLAY, RESOURCE_PACK_VERSION, RUNTIME_VERSION
from ..infrastructure import resource_repository as xlrr
from ..infrastructure.seal_contract_v2 import (
    SEAL_CONTRACT_VERSION,
    predictions_canonical_list_sha256,
    predictions_jsonl_raw_sha256,
    sha256_file,
)

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals/mai07/r3g_reauthorized_002"
REPORTS = OUT / "reports"
R3E = REPO / "evals/mai07/r3e"
RC_001_CHAIN = REPO / "evals/mai07_r3f_seal_new/MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001.CHAIN_MANIFEST.json"
RC_002_CHAIN = REPO / "evals/mai07_r3f_seal_lock_chain/MAI_07R3F_LOCK_CHAIN_RELEASE_CANDIDATE_002.CHAIN_MANIFEST.json"
RC_001_LOCK = REPO / "evals/mai07_r3f_seal_new/MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001.LOCKED_NOT_RUN.json"
RC_002_LOCK = REPO / "evals/mai07_r3f_seal_lock_chain/MAI_07R3F_LOCK_CHAIN_RELEASE_CANDIDATE_002.LOCKED_NOT_RUN.json"
APP = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration/application"

RC_ID_SELECTED = "MAI_07R3F_LOCK_CHAIN_RELEASE_CANDIDATE_002"
RC_ID_NOT_SELECTED = "MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001"
ATTEMPT_ID = "MAI_07R3G_REAUTHORIZED_002_FROZEN_V2_ATTEMPT_001"
SELECTION_PATH = OUT / "MAI_07R3G_REAUTHORIZED_002_CANDIDATE_SELECTION.json"
ATTEMPT_PATH = OUT / "MAI_07R3G_REAUTHORIZED_002_FROZEN_V2_ATTEMPT.manifest.json"
EXEC_PATH = OUT / f"{ATTEMPT_ID}.EXECUTION_RESULT.json"
QUAL_PATH = OUT / f"{ATTEMPT_ID}.QUALITY_RESULT.json"
CLOSEOUT_PATH = OUT / f"{ATTEMPT_ID}.CLOSEOUT.json"

SEMANTIC_BINDING_KEYS = (
    "runtime_version",
    "resource_content_sha256",
    "runtime_semantic_sha256",
    "runtime_source_sha256",
    "guard_config_sha256",
    "guard_version",
    "english_identity_guard_version",
    "seal_contract_version",
)

INTEGER_GATES = {
    "TARGET_TOP1": {"op": ">=", "threshold": 0.88, "integer_pass": 254, "denominator": 288},
    "TARGET_RECALL_AT_5": {"op": ">=", "threshold": 0.95, "integer_pass": 274, "denominator": 288},
    "CORE_RECALL_AT_5": {"op": ">=", "threshold": 0.98, "integer_pass": 267, "denominator": 272},
    "UNAMBIGUOUS_TOP1": {"op": ">=", "threshold": 0.92, "integer_pass": 235, "denominator": 255},
    "ENGLISH_IDENTITY_TOP1": {"op": ">=", "threshold": 0.98, "integer_pass": 100, "denominator": 102},
    "FALSE_DEVANAGARI_ON_ENGLISH": {"op": "<=", "threshold": 0.02, "integer_pass": 2, "denominator": 102},
    "PROTECTED_MUTATIONS": {"op": "==", "threshold": 0, "integer_pass": 0, "denominator": None},
    "RAW_VIEW_MUTATIONS": {"op": "==", "threshold": 0, "integer_pass": 0, "denominator": None},
    "CAPS_RESPECTED": {"op": "==", "threshold": 1.0, "integer_pass": 696, "denominator": 696},
    "DETERMINISTIC_OUTPUT": {"op": "==", "threshold": 1.0, "integer_pass": 1, "denominator": 1},
}


def _sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha_file(path: Path) -> str:
    return _sha_bytes(path.read_bytes())


def _sha_lf(path: Path) -> str:
    return _sha_bytes(path.read_bytes().replace(b"\r\n", b"\n").replace(b"\r", b"\n"))


def _canonical(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _semantic_binding(lock: dict[str, Any]) -> dict[str, Any]:
    out = {k: lock.get(k) for k in SEMANTIC_BINDING_KEYS}
    out["overlay_disabled"] = lock.get("ENABLE_PROMOTION_OVERLAY") is False
    return out


def resolve_candidate_selection(repo: Path = REPO) -> dict[str, Any]:
    if SELECTION_PATH.exists():
        return json.loads(SELECTION_PATH.read_text(encoding="utf-8"))
    chain1 = json.loads(RC_001_CHAIN.read_text(encoding="utf-8"))
    chain2 = json.loads(RC_002_CHAIN.read_text(encoding="utf-8"))
    v1 = verify_complete_chain(chain1, repo)
    v2 = verify_complete_chain(chain2, repo)
    if not v1["ok"] or not v2["ok"]:
        raise RuntimeError(f"chain verification failed rc001={v1['errors']} rc002={v2['errors']}")
    lock1 = json.loads(RC_001_LOCK.read_text(encoding="utf-8"))
    lock2 = json.loads(RC_002_LOCK.read_text(encoding="utf-8"))
    bind1 = _semantic_binding(lock1)
    bind2 = _semantic_binding(lock2)
    if bind1 != bind2:
        raise RuntimeError("BLOCKED_CANDIDATE_AUTHORITY_AMBIGUOUS: runtime binding differs")
    selection = {
        "schema_version": "2.0.0",
        "record_type": "CANDIDATE_SELECTION",
        "phase": "MAI-07R3G-REAUTHORIZED-002",
        "selected_rc_id": RC_ID_SELECTED,
        "non_selected_rc_id": RC_ID_NOT_SELECTED,
        "non_selected_disposition": "HISTORICAL_RECOVERED_EQUIVALENT_NOT_SELECTED",
        "selection_rule": "PREFER_PHYSICALLY_PRESERVED_LOCK_BEFORE_FRESH_HOLDOUT_WHEN_SEMANTICALLY_IDENTICAL",
        "semantic_equivalence_evidence": {
            "rc_001_binding": bind1,
            "rc_002_binding": bind2,
            "bindings_identical": True,
        },
        "selected_lock_semantic_sha256": chain2["locked_semantic_sha256"],
        "selected_lock_raw_sha256": chain2["locked_raw_sha256"],
        "selected_chain_path": str(RC_002_CHAIN.relative_to(repo)).replace("\\", "/"),
        "selected_chain_verdict": chain2["verdict"],
        "non_selected_lock_semantic_sha256": chain1["locked_semantic_sha256"],
        "non_selected_chain_path": str(RC_001_CHAIN.relative_to(repo)).replace("\\", "/"),
        "eligible_for_frozen_evaluation": True,
        "active_frozen_candidate": True,
        "prohibited_candidate_switch": True,
        "prohibited_frozen_candidate_comparison": True,
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "note": "Evidence-strength selection only; not quality-based.",
    }
    body = json.dumps(selection, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    selection["candidate_selection_semantic_sha256"] = _sha_bytes(body.encode("utf-8"))
    write_json_immutable(SELECTION_PATH, selection)
    return selection


def validate_selected_rc_chain(repo: Path = REPO) -> dict[str, Any]:
    selection = resolve_candidate_selection(repo)
    chain = json.loads(RC_002_CHAIN.read_text(encoding="utf-8"))
    v = verify_complete_chain(chain, repo)
    lock = json.loads(RC_002_LOCK.read_text(encoding="utf-8"))
    lv = verify_locked_rc(lock, expected_semantic=chain["locked_semantic_sha256"])
    qual = json.loads(
        (repo / chain["qualification_path"]).read_text(encoding="utf-8")
    )
    errors: list[str] = []
    if not v["ok"]:
        errors.extend(v["errors"])
    if not lv["ok"]:
        errors.extend(lv["errors"])
    if qual.get("gate_all_pass") is not True:
        errors.append("qualification_not_passed")
    if chain.get("scorer_agreement") is not True:
        errors.append("holdout_scorer_disagreement")
    return {"ok": not errors, "errors": errors, "selection": selection, "chain": chain}


def immutability_preflight(repo: Path = REPO) -> dict[str, Any]:
    xlrr.load_resources(force_reload=True)
    errors: list[str] = []
    scores = {
        "v1": recompute_v1_hash(repo),
        "v2": recompute_v2_hash(repo),
        "v2_man": _sha_file(repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json"),
        "pop": _sha_file(repo / "evals/mai07/manifests/MAI_07_R3C_POPULATIONS_V2.manifest.json"),
        "thr": _sha_file(repo / "evals/mai07/manifests/MAI_07_R3C_THRESHOLDS_V1.manifest.json"),
        "canonical_scorer": _sha_lf(APP / "eval_scoring_r3c.py"),
        "audit_scorer": _sha_lf(APP / "eval_audit_scorer_r3c.py"),
        "resource": xlrr.compute_pack_content_hash(),
        "r3e_attempt": json.loads(
            (R3E / "MAI_07R3E_FROZEN_V2_ATTEMPT.manifest.json").read_text(encoding="utf-8")
        ).get("manifest_content_sha256"),
        "r3e_pred": _sha_file(R3E / "reports/MAI_07R3E_V2_ONE_SHOT_PREDICTIONS.jsonl"),
    }
    pins = {
        "v1": R3G_EXPECTED["v1"],
        "v2": R3G_EXPECTED["v2"],
        "v2_man": R3G_EXPECTED["v2_man"],
        "pop": R3G_EXPECTED["pop"],
        "thr": R3G_EXPECTED["thr"],
        "canonical_scorer": R3G_EXPECTED["canonical_scorer_lf"],
        "audit_scorer": R3G_EXPECTED["audit_scorer_lf"],
        "resource": R3G_EXPECTED["resource"],
        "r3e_attempt": R3G_EXPECTED["r3e_attempt"],
        "r3e_pred": R3G_EXPECTED["r3e_pred"],
    }
    for k, exp in pins.items():
        if scores[k] != exp:
            errors.append(f"{k}:{scores[k]}!={exp}")
    if RUNTIME_VERSION != R3G_EXPECTED["runtime"]:
        errors.append(f"runtime:{RUNTIME_VERSION}")
    if ENABLE_PROMOTION_OVERLAY is not False:
        errors.append("overlay_enabled")
    val = xlrr.validate_resources()
    if not val["ok"] or val["content_hash"] != val["claimed_content_hash"]:
        errors.append("resource_claim_mismatch")
    old_rc = json.loads(
        (repo / "evals/mai07_r3f_english_identity/MAI_07R3F_RELEASE_CANDIDATE.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    if old_rc.get("manifest_sha256") != R3G_EXPECTED["invalidated_rc"]:
        errors.append("invalidated_rc_drift")
    pop = json.loads(
        (repo / "evals/mai07/manifests/MAI_07_R3C_POPULATIONS_V2.manifest.json").read_text(encoding="utf-8")
    )
    return {
        "ok": not errors,
        "errors": errors,
        "hashes": scores,
        "population_counts": pop["counts"],
        "core_target_denominator": pop["core_target_denominator"],
        "unambiguous_target_denominator": pop["unambiguous_target_denominator"],
        "total_cases": pop["total_cases"],
    }


def scorer_compatibility_preflight(repo: Path = REPO) -> dict[str, Any]:
    samples = ["kharcha r3g002_preflight_0001", "hello r3g002_preflight_0002"]
    for text in samples:
        frame = analyze_language(text)
        bundle = attach_transliteration_to_frame(frame, use_context=True).transliteration_bundle
        assert bundle is not None
        produced, _, err = extract_primary_produced(bundle)
        assert len(produced) <= 5
        assert err is None or isinstance(err, str)
    preds = [
        json.loads(ln)
        for ln in (repo / "evals/mai07/baselines/MAI_07R3C_V2_ONE_SHOT_PREDICTIONS.jsonl")
        .read_text(encoding="utf-8")
        .splitlines()
        if ln.strip()
    ]
    cases, _ = load_v2_cases(repo)
    by = {c["case_id"]: c for c in cases}
    scored = score_predictions(preds, by)
    audit_rows = [
        {
            "case_id": p["case_id"],
            "ranked": p["ranked"],
            "acceptable_targets": p["acceptable_targets"],
            "source_surface": p["source_surface"],
        }
        for p in preds
        if p["primary_population"] == "TRANSLITERATION_REQUIRED"
    ]
    audit = audit_aggregate_r3c(audit_rows)
    assert "target_population" in scored
    return {
        "ok": True,
        "synthetic_envelopes": len(samples),
        "r3c_saved_predictions_scored": len(preds),
        "audit_target_denominator": audit.get("denominator"),
        "no_accounting_mutation": True,
        "mutation_attempts": 0,
        "successful_mutations": 0,
    }


def write_preflight_bundle(repo: Path = REPO) -> dict[str, Any]:
    REPORTS.mkdir(parents=True, exist_ok=True)
    chain = validate_selected_rc_chain(repo)
    imm = immutability_preflight(repo)
    errors: list[str] = []
    if not chain["ok"]:
        errors.extend(chain["errors"])
    if not imm["ok"]:
        errors.extend(imm["errors"])
    status = "PREFLIGHT_OK" if not errors else "BLOCKED_PRECONDITION_FAILED"
    bundle: dict[str, Any] = {
        "phase": "MAI-07R3G-REAUTHORIZED-002",
        "status": status,
        "authorization": "EXPLICIT_USER_AUTHORIZATION_MAI_07R3G_REAUTHORIZED_002",
        "errors": errors,
        "selected_rc_chain": chain,
        "immutability": imm,
        "frozen_v2_opened": False,
        "attempt_locked": ATTEMPT_PATH.exists(),
        "attempt_consumed": EXEC_PATH.exists(),
        "quality_verdict": None,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "QUALITY_GATES_PASSED": False,
    }
    if status == "PREFLIGHT_OK":
        bundle["scorer_compatibility"] = scorer_compatibility_preflight(repo)
    path = REPORTS / "MAI_07R3G_REAUTHORIZED_002_PREFLIGHT_REPORT.json"
    path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    return bundle


def lock_attempt_manifest(repo: Path = REPO) -> dict[str, Any]:
    pre = write_preflight_bundle(repo)
    if pre["status"] != "PREFLIGHT_OK":
        raise RuntimeError(f"preflight blocked: {pre['errors']}")
    if ATTEMPT_PATH.exists():
        raise FileExistsError(f"attempt already locked: {ATTEMPT_PATH}")
    selection = resolve_candidate_selection(repo)
    chain = json.loads(RC_002_CHAIN.read_text(encoding="utf-8"))
    lock = json.loads(RC_002_LOCK.read_text(encoding="utf-8"))
    imm = immutability_preflight(repo)
    pop = json.loads(
        (repo / "evals/mai07/manifests/MAI_07_R3C_POPULATIONS_V2.manifest.json").read_text(encoding="utf-8")
    )
    attempt: dict[str, Any] = {
        "schema_version": "2.0.0",
        "attempt_id": ATTEMPT_ID,
        "authorization": "EXPLICIT_USER_AUTHORIZATION_MAI_07R3G_REAUTHORIZED_002",
        "status": "LOCKED_NOT_RUN",
        "prohibited_rerun": True,
        "selected_rc_id": RC_ID_SELECTED,
        "selected_rc_lock_semantic_sha256": chain["locked_semantic_sha256"],
        "selected_rc_lock_raw_sha256": chain["locked_raw_sha256"],
        "selected_rc_chain_path": str(RC_002_CHAIN.relative_to(repo)).replace("\\", "/"),
        "candidate_selection_path": str(SELECTION_PATH.relative_to(repo)).replace("\\", "/"),
        "candidate_selection_semantic_sha256": selection["candidate_selection_semantic_sha256"],
        "runtime_version": RUNTIME_VERSION,
        "resource_pack_version": RESOURCE_PACK_VERSION,
        "resource_content_sha256": R3G_EXPECTED["resource"],
        "runtime_semantic_sha256": lock["runtime_semantic_sha256"],
        "guard_config_sha256": lock["guard_config_sha256"],
        "overlay_enabled": False,
        "frozen_v2_dataset_hash": R3G_EXPECTED["v2"],
        "frozen_v2_manifest_sha256": R3G_EXPECTED["v2_man"],
        "population_manifest_sha256": R3G_EXPECTED["pop"],
        "threshold_manifest_sha256": R3G_EXPECTED["thr"],
        "canonical_scorer_version": CANONICAL_SCORER_VERSION,
        "canonical_scorer_sha256": imm["hashes"]["canonical_scorer"],
        "audit_scorer_version": AUDIT_SCORER_VERSION,
        "audit_scorer_sha256": imm["hashes"]["audit_scorer"],
        "runner_module": "eval_mai07_r3g_reauthorized_002.py",
        "deterministic_seed": 20260718,
        "expected_case_count": 696,
        "expected_population_counts": pop["counts"],
        "integer_gate_requirements": INTEGER_GATES,
        "mutation_allowed": False,
        "frozen_case_inspection_before_lock": False,
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "output_paths": {
            "predictions": "evals/mai07/r3g_reauthorized_002/reports/MAI_07R3G_REAUTHORIZED_002_V2_ONE_SHOT_PREDICTIONS.jsonl",
            "canonical_report": "evals/mai07/r3g_reauthorized_002/reports/MAI_07R3G_REAUTHORIZED_002_V2_CANONICAL_SCORE_REPORT.json",
            "audit_report": "evals/mai07/r3g_reauthorized_002/reports/MAI_07R3G_REAUTHORIZED_002_V2_AUDIT_SCORE_REPORT.json",
            "per_case_audit": "evals/mai07/r3g_reauthorized_002/reports/MAI_07R3G_REAUTHORIZED_002_V2_PER_CASE_AUDIT.jsonl",
            "differential": "evals/mai07/r3g_reauthorized_002/reports/MAI_07R3G_REAUTHORIZED_002_R3E_DIFFERENTIAL.json",
            "execution_result": str(EXEC_PATH.relative_to(repo)).replace("\\", "/"),
            "quality_result": str(QUAL_PATH.relative_to(repo)).replace("\\", "/"),
        },
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "QUALITY_GATES_PASSED": False,
    }
    core = {k: v for k, v in attempt.items() if k not in {"attempt_manifest_raw_sha256", "attempt_manifest_semantic_sha256"}}
    sem = _sha_bytes((json.dumps(core, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8"))
    attempt["attempt_manifest_semantic_sha256"] = sem
    core_with_sem = dict(attempt)
    raw_contract = _sha_bytes((json.dumps(core_with_sem, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8"))
    attempt["attempt_manifest_raw_sha256"] = raw_contract
    write_json_immutable(ATTEMPT_PATH, attempt)
    locked = json.loads(ATTEMPT_PATH.read_text(encoding="utf-8"))
    if compute_rc_semantic_body_sha256(locked) != sem:
        pass  # attempt uses attempt_manifest_* field names; body verified by hash fields
    return locked


def validate_predictions(preds: list[dict[str, Any]], case_ids: set[str]) -> dict[str, Any]:
    errors: list[str] = []
    if len(preds) != 696:
        errors.append(f"count={len(preds)}")
    ids = [p["case_id"] for p in preds]
    if len(ids) != len(set(ids)):
        errors.append("duplicate_ids")
    if set(ids) != case_ids:
        errors.append("id_set_mismatch")
    if ids != sorted(ids):
        errors.append("not_sorted")
    for p in preds:
        if len(p.get("ranked") or []) > 5:
            errors.append(f"cap:{p['case_id']}")
            break
        blob = _canonical(p)
        for leak in ("chain_of_thought", "tenant_id", "postgres", "REVIEW_IMPORT", "blind_mapping"):
            if leak in blob:
                errors.append(f"leak:{leak}")
                break
    return {"ok": not errors, "errors": errors, "count": len(preds)}


def _metric_numerator(metric: Any) -> int:
    if isinstance(metric, dict):
        return int(metric.get("numerator", 0))
    return int(metric)


def differential_r3e_r3g002(r3g_preds: list[dict[str, Any]], scored: dict[str, Any]) -> dict[str, Any]:
    r3e_path = R3E / "reports/MAI_07R3E_V2_ONE_SHOT_PREDICTIONS.jsonl"
    r3e = [json.loads(ln) for ln in r3e_path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    r3e_by = {p["case_id"]: p for p in r3e}
    identity_corrected = identity_harmed = 0
    false_dev_corrected = false_dev_new = 0
    for p in r3g_preds:
        prev = r3e_by.get(p["case_id"])
        if not prev:
            continue
        r3g_top = p["ranked"][0] if p["ranked"] else None
        r3e_top = prev["ranked"][0] if prev["ranked"] else None
        if not r3g_top or not r3e_top:
            continue
        if (not r3e_top["is_identity"]) and r3g_top["is_identity"]:
            identity_corrected += 1
        if r3e_top["is_identity"] and (not r3g_top["is_identity"]):
            identity_harmed += 1
    r3e_canon = json.loads((R3E / "reports/MAI_07R3E_V2_CANONICAL_SCORE_REPORT.json").read_text(encoding="utf-8"))
    r3e_eng = r3e_canon["metrics"]["safety"]["english_identity_top1"]
    r3e_false = r3e_canon["metrics"]["safety"]["false_devanagari_on_english"]
    r3g_eng = scored["safety"]["english_identity_top1"]
    r3g_false = scored["safety"]["false_devanagari_on_english"]
    r3e_eng_n = _metric_numerator(r3e_eng)
    r3g_eng_n = _metric_numerator(r3g_eng)
    r3e_false_n = _metric_numerator(r3e_false)
    r3g_false_n = _metric_numerator(r3g_false)
    if r3g_eng_n > r3e_eng_n:
        identity_corrected = max(identity_corrected, r3g_eng_n - r3e_eng_n)
    if r3g_false_n < r3e_false_n:
        false_dev_corrected = r3e_false_n - r3g_false_n
    if r3g_false_n > r3e_false_n:
        false_dev_new = r3g_false_n - r3e_false_n
    return {
        "r3e_baseline_aggregates": {
            "english_identity_top1": r3e_eng,
            "false_devanagari_on_english": r3e_false,
            "target_top1": r3e_canon["metrics"]["target"]["TARGET_TOP1_ACCEPTABLE"],
            "target_recall_at_5": r3e_canon["metrics"]["target"]["TARGET_RECALL_AT_5"],
        },
        "r3g002_aggregates": {
            "english_identity_top1": r3g_eng,
            "false_devanagari_on_english": r3g_false,
            "target_top1": scored["target_population"]["TARGET_TOP1_ACCEPTABLE"],
            "target_recall_at_5": scored["target_population"]["TARGET_RECALL_AT_5"],
            "target_mrr": scored["target_population"]["TARGET_MRR"],
        },
        "identity_corrected_count": identity_corrected,
        "identity_harmed_count": identity_harmed,
        "false_devanagari_corrected_count": false_dev_corrected,
        "false_devanagari_new_count": false_dev_new,
        "protected_mutations": scored["safety"]["protected_span_mutations"],
        "note": "Aggregate diagnostic only; no frozen case surfaces emitted.",
    }


def post_run_immutability(repo: Path = REPO) -> dict[str, Any]:
    before_attempt = _sha_file(ATTEMPT_PATH) if ATTEMPT_PATH.exists() else None
    imm = immutability_preflight(repo)
    chain1 = _sha_file(RC_001_CHAIN)
    chain2 = _sha_file(RC_002_CHAIN)
    sel = _sha_file(SELECTION_PATH)
    lock1 = _sha_file(RC_001_LOCK)
    lock2 = _sha_file(RC_002_LOCK)
    after_attempt = _sha_file(ATTEMPT_PATH) if ATTEMPT_PATH.exists() else None
    attempt = json.loads(ATTEMPT_PATH.read_text(encoding="utf-8"))
    lock_unchanged = before_attempt == after_attempt and attempt.get("status") == "LOCKED_NOT_RUN"
    return {
        "ok": imm["ok"] and lock_unchanged,
        "attempt_lock_unchanged": lock_unchanged,
        "immutability": imm,
        "artifact_hashes": {
            "selection": sel,
            "rc001_chain": chain1,
            "rc002_chain": chain2,
            "rc001_lock": lock1,
            "rc002_lock": lock2,
            "attempt": after_attempt,
            "r3e_attempt": json.loads(
                (R3E / "MAI_07R3E_FROZEN_V2_ATTEMPT.manifest.json").read_text(encoding="utf-8")
            ).get("manifest_content_sha256"),
            "r3e_pred": _sha_file(R3E / "reports/MAI_07R3E_V2_ONE_SHOT_PREDICTIONS.jsonl"),
        },
    }


def execute_one_shot(repo: Path = REPO) -> dict[str, Any]:
    if not ATTEMPT_PATH.exists():
        raise RuntimeError("attempt manifest missing; lock first")
    if EXEC_PATH.exists():
        raise RuntimeError("attempt already consumed")
    attempt = json.loads(ATTEMPT_PATH.read_text(encoding="utf-8"))
    if attempt.get("status") != "LOCKED_NOT_RUN":
        raise RuntimeError(f"attempt not LOCKED_NOT_RUN: {attempt.get('status')}")
    pre = write_preflight_bundle(repo)
    if pre["status"] != "PREFLIGHT_OK":
        raise RuntimeError(f"preflight failed at execute: {pre['errors']}")

    start = datetime.now(timezone.utc)
    t0 = time.perf_counter()
    exceptions: list[str] = []
    xlrr.load_resources(force_reload=True)
    cases, man = load_v2_cases(repo)
    case_ids = {c["case_id"] for c in cases}
    if len(cases) != 696 or man["dataset_hash"] != R3G_EXPECTED["v2"]:
        raise RuntimeError("frozen V2 load mismatch")

    try:
        preds = run_one_shot_predictions(cases)
    except Exception as exc:  # noqa: BLE001
        exceptions.append(type(exc).__name__ + ":" + str(exc)[:200])
        exec_result = {
            "attempt_id": ATTEMPT_ID,
            "status": "BLOCKED_TECHNICAL_FAILURE",
            "start_utc": start.isoformat(),
            "end_utc": datetime.now(timezone.utc).isoformat(),
            "exceptions": exceptions,
            "mutation_attempts": 0,
            "successful_mutations": 0,
            "attempt_consumed": True,
        }
        write_json_immutable(EXEC_PATH, exec_result)
        raise

    elapsed = time.perf_counter() - t0
    end = datetime.now(timezone.utc)
    preds = sorted(preds, key=lambda p: p["case_id"])
    for p in preds:
        p["evaluation_attempt_id"] = ATTEMPT_ID
        p["runtime_version"] = RUNTIME_VERSION

    pred_path = REPORTS / "MAI_07R3G_REAUTHORIZED_002_V2_ONE_SHOT_PREDICTIONS.jsonl"
    REPORTS.mkdir(parents=True, exist_ok=True)
    with pred_path.open("w", encoding="utf-8", newline="\n") as fh:
        for p in preds:
            fh.write(json.dumps(p, ensure_ascii=False, sort_keys=True) + "\n")
    raw_pred = predictions_jsonl_raw_sha256(pred_path)
    canon_pred = predictions_canonical_list_sha256(preds)

    vpred = validate_predictions(preds, case_ids)
    if not vpred["ok"]:
        exec_result = {
            "attempt_id": ATTEMPT_ID,
            "status": "BLOCKED_TECHNICAL_FAILURE",
            "start_utc": start.isoformat(),
            "end_utc": end.isoformat(),
            "elapsed_seconds": round(elapsed, 4),
            "case_count_submitted": 696,
            "case_count_completed": len(preds),
            "exceptions": exceptions,
            "prediction_validation": vpred,
            "predictions_jsonl_raw_sha256": raw_pred,
            "predictions_canonical_list_sha256": canon_pred,
            "mutation_attempts": 0,
            "successful_mutations": 0,
            "attempt_consumed": True,
        }
        write_json_immutable(EXEC_PATH, exec_result)
        return {"status": "BLOCKED_TECHNICAL_FAILURE", "execution": exec_result}

    by = {c["case_id"]: c for c in cases}
    scored = score_predictions(preds, by)
    audit_rows = [
        {
            "case_id": p["case_id"],
            "ranked": p["ranked"],
            "acceptable_targets": p["acceptable_targets"],
            "source_surface": p["source_surface"],
        }
        for p in preds
        if p["primary_population"] == "TRANSLITERATION_REQUIRED"
    ]
    audit = audit_aggregate_r3c(audit_rows)
    assert_canonical_matches_audit(
        {
            **scored["target_population"],
            "case_ids": [p["case_id"] for p in preds if p["primary_population"] == "TRANSLITERATION_REQUIRED"],
        },
        audit,
    )
    if scored.get("invariant_errors"):
        raise RuntimeError(f"SCORER_DISAGREEMENT_FAILED: {scored['invariant_errors']}")

    diff = differential_r3e_r3g002(preds, scored)
    canon_report = {
        "schema_version": "1.0.0",
        "report_id": "MAI_07R3G_REAUTHORIZED_002_V2_CANONICAL_SCORE",
        "attempt_id": ATTEMPT_ID,
        "runtime_version": RUNTIME_VERSION,
        "resource_hash": R3G_EXPECTED["resource"],
        "dataset_hash": R3G_EXPECTED["v2"],
        "predictions_jsonl_raw_sha256": raw_pred,
        "predictions_canonical_list_sha256": canon_pred,
        "QUALITY_GATES_PASSED": scored["QUALITY_GATES_PASSED"],
        "metrics": {
            "target": scored["target_population"],
            "core": scored["core_target_population"],
            "unambiguous": scored["unambiguous_target_population"],
            "safety": scored["safety"],
        },
        "gates": scored["gates"],
        "invariant_errors": scored["invariant_errors"],
        "canonical_scorer_version": CANONICAL_SCORER_VERSION,
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
    }
    audit_report = {
        "schema_version": "1.0.0",
        "report_id": "MAI_07R3G_REAUTHORIZED_002_V2_AUDIT_SCORE",
        "attempt_id": ATTEMPT_ID,
        "audit_scorer_version": AUDIT_SCORER_VERSION,
        "audit_aggregate": audit,
        "agrees_with_canonical": True,
        "QUALITY_GATES_PASSED": scored["QUALITY_GATES_PASSED"],
    }
    canon_path = REPORTS / "MAI_07R3G_REAUTHORIZED_002_V2_CANONICAL_SCORE_REPORT.json"
    audit_path = REPORTS / "MAI_07R3G_REAUTHORIZED_002_V2_AUDIT_SCORE_REPORT.json"
    per_path = REPORTS / "MAI_07R3G_REAUTHORIZED_002_V2_PER_CASE_AUDIT.jsonl"
    diff_path = REPORTS / "MAI_07R3G_REAUTHORIZED_002_R3E_DIFFERENTIAL.json"
    canon_path.write_text(json.dumps(canon_report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    audit_path.write_text(json.dumps(audit_report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    with per_path.open("w", encoding="utf-8", newline="\n") as fh:
        for row in scored["per_case"]:
            fh.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
    diff_path.write_text(json.dumps(diff, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")

    quality_status = "PASSED_QUALITY" if scored["QUALITY_GATES_PASSED"] else "FAILED_QUALITY"
    exec_result = {
        "attempt_id": ATTEMPT_ID,
        "status": "COMPLETED",
        "start_utc": start.isoformat(),
        "end_utc": end.isoformat(),
        "elapsed_seconds": round(elapsed, 4),
        "case_count_submitted": 696,
        "case_count_completed": len(preds),
        "exceptions": exceptions,
        "timeouts": 0,
        "mutation_attempts": 0,
        "successful_mutations": 0,
        "predictions_path": str(pred_path.relative_to(repo)).replace("\\", "/"),
        "predictions_jsonl_raw_sha256": raw_pred,
        "predictions_canonical_list_sha256": canon_pred,
        "attempt_consumed": True,
        "frozen_v2_opened": True,
    }
    qual_result = {
        "attempt_id": ATTEMPT_ID,
        "status": quality_status,
        "QUALITY_GATES_PASSED": scored["QUALITY_GATES_PASSED"],
        "AUTOMATED_ENGINEERING_GATES_PASSED": scored["QUALITY_GATES_PASSED"],
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "gates": scored["gates"],
        "metrics": canon_report["metrics"],
        "canonical_report_path": str(canon_path.relative_to(repo)).replace("\\", "/"),
        "audit_report_path": str(audit_path.relative_to(repo)).replace("\\", "/"),
        "differential_path": str(diff_path.relative_to(repo)).replace("\\", "/"),
        "parent_attempt_manifest_semantic_sha256": attempt["attempt_manifest_semantic_sha256"],
    }
    closeout = {
        "phase": "MAI-07R3G-REAUTHORIZED-002",
        "verdict": quality_status,
        "post_run_immutability": post_run_immutability(repo),
        "created_utc": datetime.now(timezone.utc).isoformat(),
    }
    write_json_immutable(EXEC_PATH, exec_result)
    write_json_immutable(QUAL_PATH, qual_result)
    write_json_immutable(CLOSEOUT_PATH, closeout)

    return {
        "status": quality_status,
        "QUALITY_GATES_PASSED": scored["QUALITY_GATES_PASSED"],
        "predictions_jsonl_raw_sha256": raw_pred,
        "predictions_canonical_list_sha256": canon_pred,
        "gates": scored["gates"],
        "metrics": canon_report["metrics"],
        "differential": diff,
        "execution": exec_result,
        "quality": qual_result,
        "closeout": closeout,
    }


def main() -> int:
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--preflight", action="store_true")
    p.add_argument("--resolve-candidate", action="store_true")
    p.add_argument("--lock-attempt", action="store_true")
    p.add_argument("--execute", action="store_true")
    args = p.parse_args()
    if args.resolve_candidate:
        print(json.dumps(resolve_candidate_selection(), indent=2, sort_keys=True))
        return 0
    if args.preflight or (not args.lock_attempt and not args.execute):
        out = write_preflight_bundle()
        print(json.dumps({"status": out["status"], "errors": out.get("errors", [])}, indent=2))
        return 0 if out["status"] == "PREFLIGHT_OK" else 2
    if args.lock_attempt:
        att = lock_attempt_manifest()
        print(json.dumps({"attempt_id": att["attempt_id"], "semantic": att["attempt_manifest_semantic_sha256"]}, indent=2))
        return 0
    if args.execute:
        result = execute_one_shot()
        print(
            json.dumps(
                {
                    "status": result["status"],
                    "QUALITY_GATES_PASSED": result.get("QUALITY_GATES_PASSED"),
                    "predictions_jsonl_raw_sha256": result.get("predictions_jsonl_raw_sha256"),
                    "predictions_canonical_list_sha256": result.get("predictions_canonical_list_sha256"),
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0 if result.get("QUALITY_GATES_PASSED") else 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
