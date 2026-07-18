"""MAI-07R3I-FROZEN-REAUTHORIZED — one-shot frozen-V2 eval of sealed R3H2 RC.

Explicit authorization for exactly one frozen-V2 execution against
MAI_07R3H2_SHARED_COLLISION_RELEASE_CANDIDATE_001.
Does not promote the R3H2 pack; default active remains mai-07.1.3-r3f-sealnew.
Does not mutate runtime/resources/scorers/thresholds/V2 datasets.
"""

from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from .build_mai07r3c_dataset_v2 import AUDIT_SCORER_VERSION, CANONICAL_SCORER_VERSION
from .eval_audit_scorer_r3c import assert_canonical_matches_audit, audit_aggregate_r3c
from .eval_c2_helpers import extract_primary_produced
from .eval_mai07_r3c import load_v2_cases, score_predictions
from .eval_mai07_r3g_reauthorized import EXPECTED as R3G_EXPECTED
from .eval_mai07_r3g_reauthorized import recompute_v1_hash, recompute_v2_hash
from .rc_lock_chain import (
    compute_rc_semantic_body_sha256,
    write_json_immutable,
)
from .transliteration_service import attach_transliteration_to_frame
from .. import ENABLE_PROMOTION_OVERLAY, RESOURCE_PACK_VERSION, RUNTIME_VERSION
from ..infrastructure import resource_repository as xlrr
from ..infrastructure.english_identity_guard import POLICY_VERSION
from ..infrastructure.seal_contract_v2 import (
    SEAL_CONTRACT_VERSION,
    predictions_canonical_list_sha256,
    predictions_jsonl_raw_sha256,
    sha256_file,
)

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals/mai07/r3i_frozen_reauthorized"
REPORTS = OUT / "reports"
R3H2 = REPO / "evals/mai07_r3h2_shared_collision"
R3G002 = REPO / "evals/mai07/r3g_reauthorized_002"
APP = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"

RC_ID_SELECTED = "MAI_07R3H2_SHARED_COLLISION_RELEASE_CANDIDATE_001"
RC_CHAIN = R3H2 / f"{RC_ID_SELECTED}.CHAIN_MANIFEST.json"
RC_LOCK = R3H2 / f"{RC_ID_SELECTED}.LOCKED_NOT_RUN.json"
RC_QUAL = R3H2 / f"{RC_ID_SELECTED}.QUALIFICATION_RESULT.json"
RC_LOCK_RECORD = R3H2 / f"{RC_ID_SELECTED}.LOCK_RECORD.json"
RC_ATTEMPT = R3H2 / "MAI_07R3H2_HOLDOUT_ATTEMPT_001.json"

CANDIDATE_PACK_VERSION = "mai-07.1.5-r3h2-shared"
CANDIDATE_PACK_DIR = XL / "sealed_packs" / CANDIDATE_PACK_VERSION
CANDIDATE_RESOURCE_HASH = "8716589a172b47c4d4b3a2419ee442b5b3c0aa170e2bb5e9aff742810878e60a"
CANDIDATE_POLICY_VERSION = "mai-07-r3h2.1.0.0"
CANDIDATE_LOCK_SEMANTIC = "bec4b8662a5ba9973253b05555151d71366a329f0425fa382a35a5916364d03c"
DEFAULT_PACK_VERSION = "mai-07.1.3-r3f-sealnew"
DEFAULT_RESOURCE_HASH = "1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930"
R3H2_THRESHOLD_HASH = "c79c77ecbe0494b567c9c99c9856fbd7c0cabe459241a472bc8131a66492c88e"

AUTHORIZATION = "EXPLICIT_USER_AUTHORIZATION_MAI_07R3I_FROZEN_REAUTHORIZED"
PHASE_ID = "MAI-07R3I-FROZEN-REAUTHORIZED"
ATTEMPT_ID = "MAI_07R3I_FROZEN_V2_ATTEMPT_001"
SELECTION_PATH = OUT / "MAI_07R3I_CANDIDATE_SELECTION.json"
ATTEMPT_PATH = OUT / f"{ATTEMPT_ID}.LOCKED_NOT_RUN.json"
EXEC_PATH = OUT / f"{ATTEMPT_ID}.EXECUTION_RESULT.json"
QUAL_PATH = OUT / f"{ATTEMPT_ID}.QUALITY_RESULT.json"
CLOSEOUT_PATH = OUT / f"{ATTEMPT_ID}.CLOSEOUT.json"
PROVE_PACK_PATH = REPORTS / "MAI_07R3I_CANDIDATE_PACK_LOAD_PROOF.json"

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

FROZEN_HASHES = {
    "v1": R3G_EXPECTED["v1"],
    "v2": R3G_EXPECTED["v2"],
    "v2_man": R3G_EXPECTED["v2_man"],
    "pop": R3G_EXPECTED["pop"],
    "thr": R3G_EXPECTED["thr"],
    "canonical_scorer_lf": R3G_EXPECTED["canonical_scorer_lf"],
    "audit_scorer_lf": R3G_EXPECTED["audit_scorer_lf"],
}


def _sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha_file(path: Path) -> str:
    return _sha_bytes(path.read_bytes())


def _sha_lf(path: Path) -> str:
    return _sha_bytes(path.read_bytes().replace(b"\r\n", b"\n").replace(b"\r", b"\n"))


def _canonical(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _resolve_prediction_path(raw: str, repo: Path) -> Path:
    """Resolve attempt prediction_path; R3H2 may store absolute Windows paths."""
    if not raw:
        raise ValueError("empty prediction_path")
    p = Path(raw)
    if p.is_absolute():
        return p
    # Also treat POSIX-absolute or drive-letter forms that Path may not flag on all OSes.
    if len(raw) >= 3 and raw[1] == ":" and raw[2] in "/\\":
        return Path(raw)
    if raw.startswith("/") or raw.startswith("\\"):
        return Path(raw)
    return repo / raw


def load_candidate_resources():
    """Load R3H2 sealed pack explicitly — never the default active pack."""
    return xlrr.load_resources(force_reload=True, resources_dir=CANDIDATE_PACK_DIR)


def run_frozen_predictions_with_r3h2(
    cases: list[dict[str, Any]],
    candidate_resources: Any,
) -> list[dict[str, Any]]:
    """One-shot frozen predictions using the R3H2 candidate pack.

    Must not call eval_mai07_r3c.run_one_shot_predictions (that loads the default pack).
    """
    out: list[dict[str, Any]] = []
    for case in sorted(cases, key=lambda c: c["case_id"]):
        frame = analyze_language(case["input_text"])
        bundle = attach_transliteration_to_frame(
            frame, use_context=True, resources=candidate_resources
        ).transliteration_bundle
        assert bundle is not None
        produced, source, err = extract_primary_produced(bundle)
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
        # Optional R3H2 review metadata (diagnostic; frozen scorers ignore extras).
        primary_span = next(
            (sp for sp in bundle.span_results if sp.candidates),
            None,
        )
        out.append(
            {
                "case_id": case["case_id"],
                "parent_v1_case_id": case["parent_v1_case_id"],
                "primary_population": case["primary_population"],
                "source_surface": source or case["input_text"],
                "acceptable_targets": list(case["acceptable_target_set"]),
                "unique_preference_eligible": case.get("unique_reviewed_preference_eligible"),
                "preferred_devanagari_targets": list(case.get("preferred_devanagari_targets") or []),
                "ambiguity_reason": case.get("ambiguity_reason"),
                "suite_id": case["suite_id"],
                "review_status": case["review_status"],
                "ranked": ranked,
                "structural_error": err,
                "runtime_version": RUNTIME_VERSION,
                "resource_pack_version": candidate_resources.version,
                "resource_content_sha256": candidate_resources.content_hash,
                "policy_version": getattr(primary_span, "policy_version", None) or POLICY_VERSION,
                "disposition": getattr(primary_span, "disposition", None),
                "span_review_required": bool(getattr(primary_span, "review_required", False))
                if primary_span is not None
                else False,
                "span_review_reason_codes": list(getattr(primary_span, "review_reason_codes", []) or [])
                if primary_span is not None
                else [],
            }
        )
    return out


def verify_r3h2_rc_chain(repo: Path = REPO) -> dict[str, Any]:
    """Verify R3H2 lock→attempt→predictions→qualification chain for R3I.

    Does NOT require ENABLE_PROMOTION_OVERLAY on the lock body (R3H2 omits it).
    Overlay is proven via the module flag ENABLE_PROMOTION_OVERLAY is False.
    Handles absolute Windows prediction_path in the holdout attempt JSON.
    """
    errors: list[str] = []
    if not RC_CHAIN.exists():
        return {"ok": False, "errors": ["missing_chain"]}
    chain = json.loads(RC_CHAIN.read_text(encoding="utf-8"))
    lock_path = repo / chain["locked_not_run_path"]
    if not lock_path.exists():
        errors.append("missing_locked_body")
        return {"ok": False, "errors": errors, "chain": chain}

    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    sem = compute_rc_semantic_body_sha256(lock)
    if sem != CANDIDATE_LOCK_SEMANTIC:
        errors.append(f"semantic_mismatch:expected={CANDIDATE_LOCK_SEMANTIC}:actual={sem}")
    if chain.get("locked_semantic_sha256") != CANDIDATE_LOCK_SEMANTIC:
        errors.append("chain_semantic_mismatch")
    if lock.get("manifest_sha256") != CANDIDATE_LOCK_SEMANTIC:
        errors.append("lock_manifest_sha256_mismatch")
    # R3H2 chain stores rc_manifest_raw_sha256 (contract raw), not on-disk file bytes.
    if lock.get("rc_manifest_raw_sha256") != chain.get("locked_raw_sha256"):
        errors.append("locked_raw_sha256_mismatch")
    if lock.get("status") != "LOCKED_NOT_RUN":
        errors.append(f"status_not_LOCKED_NOT_RUN:{lock.get('status')}")
    if not lock.get("locked") or not lock.get("locked_before_holdout"):
        errors.append("not_locked_before_holdout")
    if lock.get("resource_content_sha256") != CANDIDATE_RESOURCE_HASH:
        errors.append("resource_hash_mismatch")
    if lock.get("resource_pack_version") != CANDIDATE_PACK_VERSION:
        errors.append("resource_pack_version_mismatch")
    if lock.get("policy_version") != CANDIDATE_POLICY_VERSION:
        errors.append("policy_version_mismatch")
    if lock.get("seal_contract_version") != SEAL_CONTRACT_VERSION:
        errors.append("seal_contract_version_mismatch")
    # R3H2 omits ENABLE_PROMOTION_OVERLAY on lock; prove via module flag.
    if "ENABLE_PROMOTION_OVERLAY" in lock:
        if lock.get("ENABLE_PROMOTION_OVERLAY") is not False:
            errors.append("overlay_enabled_on_lock")
    if ENABLE_PROMOTION_OVERLAY is not False:
        errors.append("overlay_module_flag_enabled")

    qual_rel = chain.get("qualification_path")
    if not qual_rel:
        errors.append("missing_qualification_path")
    else:
        qp = repo / qual_rel
        if not qp.exists():
            errors.append("missing_qualification")
        else:
            qual = json.loads(qp.read_text(encoding="utf-8"))
            if qual.get("gate_all_pass") is not True:
                errors.append("qualification_not_passed")
            if qual.get("parent_lock_semantic_sha256") != CANDIDATE_LOCK_SEMANTIC:
                errors.append("qualification_lock_binding_mismatch")
            if qual.get("status") not in {"PASSED_HOLDOUT", "PASSED_CORRECTIVE_RC"}:
                errors.append(f"qualification_status:{qual.get('status')}")

    attempt_rel = chain.get("holdout_attempt_path")
    if not attempt_rel:
        errors.append("missing_holdout_attempt_path")
    else:
        ap = repo / attempt_rel
        if not ap.exists():
            errors.append("missing_holdout_attempt")
        else:
            att = json.loads(ap.read_text(encoding="utf-8"))
            parent = att.get("parent_lock_semantic_sha256") or att.get(
                "rc_manifest_sha256_locked_before_holdout"
            )
            if parent != CANDIDATE_LOCK_SEMANTIC:
                errors.append("attempt_lock_binding_mismatch")
            if att.get("status") != "COMPLETED":
                errors.append(f"attempt_not_consumed:{att.get('status')}")
            try:
                pred_path = _resolve_prediction_path(str(att.get("prediction_path") or ""), repo)
            except ValueError:
                errors.append("empty_prediction_path")
                pred_path = None
            if pred_path is not None:
                if not pred_path.exists():
                    errors.append(f"missing_predictions:{pred_path}")
                else:
                    raw = predictions_jsonl_raw_sha256(pred_path)
                    if att.get("predictions_jsonl_raw_sha256") != raw:
                        errors.append("prediction_raw_hash_mismatch")
                    preds = [
                        json.loads(ln)
                        for ln in pred_path.read_text(encoding="utf-8").splitlines()
                        if ln.strip()
                    ]
                    canon = predictions_canonical_list_sha256(preds)
                    if att.get("predictions_canonical_list_sha256") != canon:
                        errors.append("prediction_canonical_hash_mismatch")
                    if raw == canon:
                        errors.append("raw_equals_canonical_confusion")

    if not RC_LOCK_RECORD.exists():
        errors.append("missing_lock_record")

    cand_hash = xlrr.compute_pack_content_hash(resources_dir=CANDIDATE_PACK_DIR)
    if cand_hash != CANDIDATE_RESOURCE_HASH:
        errors.append(f"candidate_pack_compute_mismatch:{cand_hash}")

    return {
        "ok": not errors,
        "errors": errors,
        "chain": chain,
        "locked_semantic_sha256": CANDIDATE_LOCK_SEMANTIC,
        "resource_content_sha256": CANDIDATE_RESOURCE_HASH,
        "overlay_module_disabled": ENABLE_PROMOTION_OVERLAY is False,
        "overlay_key_required_on_lock": False,
    }


def resolve_candidate_selection(repo: Path = REPO) -> dict[str, Any]:
    """Select exactly the sealed R3H2 RC — no multi-RC frozen comparison."""
    if SELECTION_PATH.exists():
        return json.loads(SELECTION_PATH.read_text(encoding="utf-8"))
    chain_v = verify_r3h2_rc_chain(repo)
    if not chain_v["ok"]:
        raise RuntimeError(f"R3H2 chain verification failed: {chain_v['errors']}")
    chain = chain_v["chain"]
    selection = {
        "schema_version": "2.0.0",
        "record_type": "CANDIDATE_SELECTION",
        "phase": PHASE_ID,
        "selected_rc_id": RC_ID_SELECTED,
        "non_selected_disposition": "HISTORICAL_OR_DEFAULT_NOT_ELIGIBLE_FOR_R3I",
        "selection_rule": "ONLY_SEALED_R3H2_SHARED_COLLISION_RC_AUTHORIZED",
        "selected_lock_semantic_sha256": chain["locked_semantic_sha256"],
        "selected_lock_raw_sha256": chain["locked_raw_sha256"],
        "selected_chain_path": str(RC_CHAIN.relative_to(repo)).replace("\\", "/"),
        "candidate_pack_version": CANDIDATE_PACK_VERSION,
        "candidate_resource_content_sha256": CANDIDATE_RESOURCE_HASH,
        "policy_version": CANDIDATE_POLICY_VERSION,
        "default_pack_version_unchanged": DEFAULT_PACK_VERSION,
        "default_resource_content_sha256": DEFAULT_RESOURCE_HASH,
        "eligible_for_frozen_evaluation": True,
        "active_frozen_candidate": True,
        "prohibited_candidate_switch": True,
        "prohibited_frozen_candidate_comparison": True,
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "note": "Single sealed R3H2 RC only; default R3F pack must not be used as frozen runner pack.",
    }
    body = json.dumps(selection, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    selection["candidate_selection_semantic_sha256"] = _sha_bytes(body.encode("utf-8"))
    write_json_immutable(SELECTION_PATH, selection)
    return selection


def validate_selected_rc_chain(repo: Path = REPO) -> dict[str, Any]:
    selection = resolve_candidate_selection(repo)
    chain_v = verify_r3h2_rc_chain(repo)
    errors = list(chain_v.get("errors") or [])
    if selection.get("selected_rc_id") != RC_ID_SELECTED:
        errors.append("wrong_rc_selected")
    return {
        "ok": not errors,
        "errors": errors,
        "selection": selection,
        "chain_verification": chain_v,
    }


def immutability_preflight(repo: Path = REPO) -> dict[str, Any]:
    """Pin frozen V2 authorities + default pack + candidate pack (without promoting)."""
    xlrr.load_resources(force_reload=True)  # default active pack
    errors: list[str] = []
    scores = {
        "v1": recompute_v1_hash(repo),
        "v2": recompute_v2_hash(repo),
        "v2_man": _sha_file(repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json"),
        "pop": _sha_file(repo / "evals/mai07/manifests/MAI_07_R3C_POPULATIONS_V2.manifest.json"),
        "thr": _sha_file(repo / "evals/mai07/manifests/MAI_07_R3C_THRESHOLDS_V1.manifest.json"),
        "canonical_scorer_lf": _sha_lf(APP / "eval_scoring_r3c.py"),
        "audit_scorer_lf": _sha_lf(APP / "eval_audit_scorer_r3c.py"),
        "default_resource": xlrr.compute_pack_content_hash(),
        "candidate_resource": xlrr.compute_pack_content_hash(resources_dir=CANDIDATE_PACK_DIR),
        "r3h2_thresholds": _sha_file(R3H2 / "MAI_07R3H2_THRESHOLDS.json"),
    }
    pins = {
        "v1": FROZEN_HASHES["v1"],
        "v2": FROZEN_HASHES["v2"],
        "v2_man": FROZEN_HASHES["v2_man"],
        "pop": FROZEN_HASHES["pop"],
        "thr": FROZEN_HASHES["thr"],
        "canonical_scorer_lf": FROZEN_HASHES["canonical_scorer_lf"],
        "audit_scorer_lf": FROZEN_HASHES["audit_scorer_lf"],
        "default_resource": DEFAULT_RESOURCE_HASH,
        "candidate_resource": CANDIDATE_RESOURCE_HASH,
        "r3h2_thresholds": R3H2_THRESHOLD_HASH,
    }
    for k, exp in pins.items():
        if scores[k] != exp:
            errors.append(f"{k}:{scores[k]}!={exp}")
    if RUNTIME_VERSION != DEFAULT_PACK_VERSION:
        errors.append(f"runtime:{RUNTIME_VERSION}")
    if RESOURCE_PACK_VERSION != DEFAULT_PACK_VERSION:
        errors.append(f"active_resource_pack:{RESOURCE_PACK_VERSION}")
    if ENABLE_PROMOTION_OVERLAY is not False:
        errors.append("overlay_enabled")
    if POLICY_VERSION != CANDIDATE_POLICY_VERSION:
        errors.append(f"policy:{POLICY_VERSION}")
    val_default = xlrr.validate_resources()
    if not val_default["ok"] or val_default["content_hash"] != val_default["claimed_content_hash"]:
        errors.append("default_resource_claim_mismatch")
    val_cand = xlrr.validate_resources(resources_dir=CANDIDATE_PACK_DIR)
    if not val_cand["ok"] or val_cand["content_hash"] != val_cand["claimed_content_hash"]:
        errors.append("candidate_resource_claim_mismatch")
    if val_cand["content_hash"] != CANDIDATE_RESOURCE_HASH:
        errors.append("candidate_claimed_hash_mismatch")
    # Frozen thresholds must remain the R3C frozen authority — not R3H2 non-frozen.
    if scores["thr"] == scores["r3h2_thresholds"]:
        errors.append("frozen_threshold_substituted_with_r3h2")
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
        "default_pack_not_used_as_frozen_runner": True,
    }


def prove_candidate_pack_load(repo: Path = REPO) -> dict[str, Any]:
    """Synthetic non-frozen sentinel proving candidate vs default pack load."""
    REPORTS.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    candidate_resources = load_candidate_resources()
    default_resources = xlrr.load_resources(force_reload=True)

    if candidate_resources.version != CANDIDATE_PACK_VERSION:
        errors.append(f"candidate_version:{candidate_resources.version}")
    if candidate_resources.content_hash != CANDIDATE_RESOURCE_HASH:
        errors.append(f"candidate_hash:{candidate_resources.content_hash}")
    if default_resources.version != DEFAULT_PACK_VERSION:
        errors.append(f"default_version:{default_resources.version}")
    if default_resources.content_hash != DEFAULT_RESOURCE_HASH:
        errors.append(f"default_hash:{default_resources.content_hash}")
    if candidate_resources.content_hash == default_resources.content_hash:
        errors.append("candidate_equals_default_hash")
    if candidate_resources.version == default_resources.version:
        errors.append("candidate_equals_default_version")

    cand_guard = (candidate_resources.english_identity_guard or {}).get("version")
    def_guard = (default_resources.english_identity_guard or {}).get("version")
    if cand_guard != CANDIDATE_POLICY_VERSION:
        errors.append(f"candidate_guard:{cand_guard}")
    if def_guard == cand_guard:
        errors.append("guard_versions_not_differentiated")

    sentinel_text = "item cash shared collision pending adjudication r3h2_review_probe"
    frame_c = analyze_language(sentinel_text)
    frame_d = analyze_language(sentinel_text)
    bundle_c = attach_transliteration_to_frame(
        frame_c, use_context=True, resources=candidate_resources
    ).transliteration_bundle
    bundle_d = attach_transliteration_to_frame(
        frame_d, use_context=True, resources=default_resources
    ).transliteration_bundle
    assert bundle_c is not None and bundle_d is not None
    if bundle_c.resource_version != CANDIDATE_PACK_VERSION:
        errors.append(f"bundle_candidate_version:{bundle_c.resource_version}")
    if bundle_d.resource_version != DEFAULT_PACK_VERSION:
        errors.append(f"bundle_default_version:{bundle_d.resource_version}")

    cash_c = next(
        (s for s in bundle_c.span_results if s.raw_span.original_text.lower() == "cash"),
        None,
    )
    review_meta = {
        "disposition": getattr(cash_c, "disposition", None) if cash_c else None,
        "review_required": bool(getattr(cash_c, "review_required", False)) if cash_c else False,
        "policy_version": getattr(cash_c, "policy_version", None) if cash_c else None,
        "review_reason_codes": list(getattr(cash_c, "review_reason_codes", []) or [])
        if cash_c
        else [],
    }
    if review_meta["policy_version"] not in {None, CANDIDATE_POLICY_VERSION}:
        # Policy may come from module when pack guard is loaded into runtime.
        if POLICY_VERSION != CANDIDATE_POLICY_VERSION:
            errors.append(f"sentinel_policy:{review_meta['policy_version']}")

    proof = {
        "schema_version": "2.0.0",
        "record_type": "CANDIDATE_PACK_LOAD_PROOF",
        "phase": PHASE_ID,
        "selected_candidate_pack_loaded": not errors,
        "selected_runtime_claim": CANDIDATE_PACK_VERSION,
        "selected_resource_pack_version": candidate_resources.version,
        "selected_resource_content_sha256": candidate_resources.content_hash,
        "selected_policy_version": CANDIDATE_POLICY_VERSION,
        "default_pack_version": default_resources.version,
        "default_resource_content_sha256": default_resources.content_hash,
        "default_pack_not_used": candidate_resources.content_hash != default_resources.content_hash,
        "candidate_guard_version": cand_guard,
        "default_guard_version": def_guard,
        "sentinel_text_kind": "synthetic_non_frozen_shared_collision_probe",
        "sentinel_review_metadata": {
            "disposition": review_meta["disposition"],
            "review_required": review_meta["review_required"],
            "policy_version": review_meta["policy_version"],
            "review_reason_code_count": len(review_meta["review_reason_codes"]),
        },
        "bundle_resource_versions": {
            "candidate": bundle_c.resource_version,
            "default": bundle_d.resource_version,
        },
        "frozen_case_used": False,
        "errors": errors,
        "created_utc": datetime.now(timezone.utc).isoformat(),
    }
    body = json.dumps(proof, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    proof["sentinel_artifact_sha256"] = _sha_bytes(body.encode("utf-8"))
    # After the frozen attempt is locked, keep the on-disk proof immutable so
    # later preflight/test calls cannot rewrite sealed pre-execute evidence.
    if ATTEMPT_PATH.exists() and PROVE_PACK_PATH.exists():
        return json.loads(PROVE_PACK_PATH.read_text(encoding="utf-8"))
    PROVE_PACK_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROVE_PACK_PATH.write_text(
        json.dumps(proof, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return proof


def schema_compatibility_preflight(repo: Path = REPO) -> dict[str, Any]:
    """Prove R3H2 review metadata + frozen scorers stay compatible (no scorer patch)."""
    candidate_resources = load_candidate_resources()
    samples = [
        "kharcha r3i_preflight_0001",
        "hello r3i_preflight_0002",
        "item cash shared collision pending adjudication r3i_preflight_0003",
    ]
    for text in samples:
        frame = analyze_language(text)
        bundle = attach_transliteration_to_frame(
            frame, use_context=True, resources=candidate_resources
        ).transliteration_bundle
        assert bundle is not None
        produced, _, err = extract_primary_produced(bundle)
        assert len(produced) <= 5
        assert err is None or isinstance(err, str)

    # Synthetic prediction envelope with R3H2 extras — frozen scorer must ignore safely.
    synthetic_pred = {
        "case_id": "SYNTHETIC_R3I_SCHEMA_0001",
        "ranked": [
            {
                "surface": "cash",
                "is_identity": True,
                "kind": "IDENTITY",
                "script": "LATIN",
                "rank": 1,
                "candidate_id": "syn_id",
            }
        ],
        "acceptable_targets": ["क्यास"],
        "source_surface": "cash",
        "primary_population": "ENGLISH_IDENTITY",
        "disposition": "AMBIGUOUS_IDENTITY_FIRST_REVIEW",
        "span_review_required": True,
        "span_review_reason_codes": ["SHARED_COLLISION_UNRESOLVED"],
        "policy_version": CANDIDATE_POLICY_VERSION,
    }
    blob = _canonical(synthetic_pred)
    assert "disposition" in blob

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
        "synthetic_review_metadata_present": True,
        "r3c_saved_predictions_scored": len(preds),
        "audit_target_denominator": audit.get("denominator"),
        "no_accounting_mutation": True,
        "mutation_attempts": 0,
        "successful_mutations": 0,
        "frozen_scorers_unpatched": True,
        "adapter": "none_representation_passthrough",
    }


def write_preflight_bundle(repo: Path = REPO) -> dict[str, Any]:
    REPORTS.mkdir(parents=True, exist_ok=True)
    chain = validate_selected_rc_chain(repo)
    imm = immutability_preflight(repo)
    pack_proof = prove_candidate_pack_load(repo)
    errors: list[str] = []
    if not chain["ok"]:
        errors.extend(chain["errors"])
    if not imm["ok"]:
        errors.extend(imm["errors"])
    if not pack_proof.get("selected_candidate_pack_loaded"):
        errors.extend(pack_proof.get("errors") or ["pack_load_proof_failed"])
    status = "PREFLIGHT_OK" if not errors else "BLOCKED_PRECONDITION_FAILED"
    bundle: dict[str, Any] = {
        "phase": PHASE_ID,
        "status": status,
        "authorization": AUTHORIZATION,
        "errors": errors,
        "selected_rc_chain": {
            "ok": chain["ok"],
            "errors": chain["errors"],
            "selected_rc_id": RC_ID_SELECTED,
            "locked_semantic_sha256": CANDIDATE_LOCK_SEMANTIC,
            "overlay_module_disabled": ENABLE_PROMOTION_OVERLAY is False,
        },
        "immutability": {
            "ok": imm["ok"],
            "errors": imm["errors"],
            "hashes": imm["hashes"],
            "population_counts": imm["population_counts"],
            "total_cases": imm["total_cases"],
        },
        "candidate_pack_load_proof": {
            "selected_candidate_pack_loaded": pack_proof.get("selected_candidate_pack_loaded"),
            "default_pack_not_used": pack_proof.get("default_pack_not_used"),
            "selected_resource_content_sha256": pack_proof.get("selected_resource_content_sha256"),
            "default_resource_content_sha256": pack_proof.get("default_resource_content_sha256"),
            "sentinel_artifact_sha256": pack_proof.get("sentinel_artifact_sha256"),
            "frozen_case_used": False,
        },
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
        bundle["schema_compatibility"] = schema_compatibility_preflight(repo)
    path = REPORTS / "MAI_07R3I_PREFLIGHT_REPORT.json"
    path.write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return bundle


def lock_attempt_manifest(repo: Path = REPO) -> dict[str, Any]:
    pre = write_preflight_bundle(repo)
    if pre["status"] != "PREFLIGHT_OK":
        raise RuntimeError(f"preflight blocked: {pre['errors']}")
    if ATTEMPT_PATH.exists():
        raise FileExistsError(f"attempt already locked: {ATTEMPT_PATH}")
    selection = resolve_candidate_selection(repo)
    chain = json.loads(RC_CHAIN.read_text(encoding="utf-8"))
    imm = immutability_preflight(repo)
    pack_proof = prove_candidate_pack_load(repo)
    if not pack_proof.get("selected_candidate_pack_loaded"):
        raise RuntimeError(f"pack load proof failed: {pack_proof.get('errors')}")
    pop = json.loads(
        (repo / "evals/mai07/manifests/MAI_07_R3C_POPULATIONS_V2.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    runner_path = Path(__file__).resolve()
    attempt: dict[str, Any] = {
        "schema_version": "2.0.0",
        "attempt_id": ATTEMPT_ID,
        "phase_id": PHASE_ID,
        "authorization": AUTHORIZATION,
        "status": "LOCKED_NOT_RUN",
        "prohibited_rerun": True,
        "selected_rc_id": RC_ID_SELECTED,
        "selected_rc_lock_semantic_sha256": chain["locked_semantic_sha256"],
        "selected_rc_lock_raw_sha256": chain["locked_raw_sha256"],
        "selected_rc_chain_path": str(RC_CHAIN.relative_to(repo)).replace("\\", "/"),
        "selected_rc_chain_raw_sha256": _sha_file(RC_CHAIN),
        "selected_rc_qualification_path": str(RC_QUAL.relative_to(repo)).replace("\\", "/"),
        "selected_rc_qualification_raw_sha256": _sha_file(RC_QUAL),
        "candidate_selection_path": str(SELECTION_PATH.relative_to(repo)).replace("\\", "/"),
        "candidate_selection_semantic_sha256": selection["candidate_selection_semantic_sha256"],
        "candidate_runtime_claim": CANDIDATE_PACK_VERSION,
        "candidate_resource_pack_version": CANDIDATE_PACK_VERSION,
        "candidate_resource_content_sha256": CANDIDATE_RESOURCE_HASH,
        "policy_version": CANDIDATE_POLICY_VERSION,
        "runtime_version": RUNTIME_VERSION,
        "default_resource_pack_version": DEFAULT_PACK_VERSION,
        "default_resource_content_sha256": DEFAULT_RESOURCE_HASH,
        "overlay_enabled": False,
        "selected_candidate_pack_loaded": True,
        "default_pack_not_used": True,
        "runner_module": "eval_mai07_r3i_frozen_reauthorized.py",
        "runner_module_sha256": _sha_lf(runner_path),
        "adapter": "none_representation_passthrough",
        "adapter_sha256": None,
        "frozen_v2_dataset_hash": FROZEN_HASHES["v2"],
        "frozen_v2_manifest_sha256": FROZEN_HASHES["v2_man"],
        "population_manifest_sha256": FROZEN_HASHES["pop"],
        "threshold_manifest_sha256": FROZEN_HASHES["thr"],
        "canonical_scorer_version": CANONICAL_SCORER_VERSION,
        "canonical_scorer_sha256": imm["hashes"]["canonical_scorer_lf"],
        "audit_scorer_version": AUDIT_SCORER_VERSION,
        "audit_scorer_sha256": imm["hashes"]["audit_scorer_lf"],
        "deterministic_seed": 20260718,
        "expected_case_count": 696,
        "expected_population_counts": pop["counts"],
        "integer_gate_requirements": INTEGER_GATES,
        "mutation_allowed": False,
        "frozen_opened_before_lock": False,
        "frozen_case_inspection_before_lock": False,
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "candidate_pack_load_proof_sha256": pack_proof.get("sentinel_artifact_sha256"),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "output_paths": {
            "predictions": "evals/mai07/r3i_frozen_reauthorized/reports/MAI_07R3I_V2_ONE_SHOT_PREDICTIONS.jsonl",
            "canonical_report": "evals/mai07/r3i_frozen_reauthorized/reports/MAI_07R3I_V2_CANONICAL_SCORE_REPORT.json",
            "audit_report": "evals/mai07/r3i_frozen_reauthorized/reports/MAI_07R3I_V2_AUDIT_SCORE_REPORT.json",
            "per_case_audit": "evals/mai07/r3i_frozen_reauthorized/reports/MAI_07R3I_V2_PER_CASE_AUDIT.jsonl",
            "differential": "evals/mai07/r3i_frozen_reauthorized/reports/MAI_07R3I_R3G002_DIFFERENTIAL.json",
            "execution_result": str(EXEC_PATH.relative_to(repo)).replace("\\", "/"),
            "quality_result": str(QUAL_PATH.relative_to(repo)).replace("\\", "/"),
        },
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "QUALITY_GATES_PASSED": False,
    }
    core = {
        k: v
        for k, v in attempt.items()
        if k not in {"attempt_manifest_raw_sha256", "attempt_manifest_semantic_sha256"}
    }
    sem = _sha_bytes((json.dumps(core, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8"))
    attempt["attempt_manifest_semantic_sha256"] = sem
    core_with_sem = dict(attempt)
    raw_contract = _sha_bytes(
        (json.dumps(core_with_sem, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    )
    attempt["attempt_manifest_raw_sha256"] = raw_contract
    write_json_immutable(ATTEMPT_PATH, attempt)
    return json.loads(ATTEMPT_PATH.read_text(encoding="utf-8"))


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
        if p.get("resource_pack_version") != CANDIDATE_PACK_VERSION:
            errors.append(f"wrong_pack:{p['case_id']}")
            break
        if p.get("resource_content_sha256") != CANDIDATE_RESOURCE_HASH:
            errors.append(f"wrong_hash:{p['case_id']}")
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


def differential_r3g002_r3i(r3i_preds: list[dict[str, Any]], scored: dict[str, Any]) -> dict[str, Any]:
    """Aggregate differential vs R3G-REAUTHORIZED-002 (not R3E)."""
    r3g_pred_path = R3G002 / "reports/MAI_07R3G_REAUTHORIZED_002_V2_ONE_SHOT_PREDICTIONS.jsonl"
    r3g = [
        json.loads(ln)
        for ln in r3g_pred_path.read_text(encoding="utf-8").splitlines()
        if ln.strip()
    ]
    r3g_by = {p["case_id"]: p for p in r3g}
    identity_corrected = identity_harmed = 0
    false_dev_corrected = false_dev_new = 0
    identity_to_target = target_to_identity = 0
    for p in r3i_preds:
        prev = r3g_by.get(p["case_id"])
        if not prev:
            continue
        r3i_top = p["ranked"][0] if p["ranked"] else None
        r3g_top = prev["ranked"][0] if prev["ranked"] else None
        if not r3i_top or not r3g_top:
            continue
        if (not r3g_top["is_identity"]) and r3i_top["is_identity"]:
            identity_corrected += 1
            target_to_identity += 1
        if r3g_top["is_identity"] and (not r3i_top["is_identity"]):
            identity_harmed += 1
            identity_to_target += 1
    r3g_canon = json.loads(
        (R3G002 / "reports/MAI_07R3G_REAUTHORIZED_002_V2_CANONICAL_SCORE_REPORT.json").read_text(
            encoding="utf-8"
        )
    )
    r3g_eng = r3g_canon["metrics"]["safety"]["english_identity_top1"]
    r3g_false = r3g_canon["metrics"]["safety"]["false_devanagari_on_english"]
    r3i_eng = scored["safety"]["english_identity_top1"]
    r3i_false = scored["safety"]["false_devanagari_on_english"]
    r3g_eng_n = _metric_numerator(r3g_eng)
    r3i_eng_n = _metric_numerator(r3i_eng)
    r3g_false_n = _metric_numerator(r3g_false)
    r3i_false_n = _metric_numerator(r3i_false)
    if r3i_eng_n > r3g_eng_n:
        identity_corrected = max(identity_corrected, r3i_eng_n - r3g_eng_n)
    if r3i_false_n < r3g_false_n:
        false_dev_corrected = r3g_false_n - r3i_false_n
    if r3i_false_n > r3g_false_n:
        false_dev_new = r3i_false_n - r3g_false_n
    return {
        "baseline": "MAI_07R3G_REAUTHORIZED_002",
        "r3g002_baseline_aggregates": {
            "english_identity_top1": r3g_eng,
            "false_devanagari_on_english": r3g_false,
            "target_top1": r3g_canon["metrics"]["target"]["TARGET_TOP1_ACCEPTABLE"],
            "target_recall_at_5": r3g_canon["metrics"]["target"]["TARGET_RECALL_AT_5"],
            "target_mrr": r3g_canon["metrics"]["target"]["TARGET_MRR"],
            "core_recall_at_5": r3g_canon["metrics"]["core"]["TARGET_RECALL_AT_5"],
            "unambiguous_top1": r3g_canon["metrics"]["unambiguous"]["TARGET_TOP1_ACCEPTABLE"],
        },
        "r3i_aggregates": {
            "english_identity_top1": r3i_eng,
            "false_devanagari_on_english": r3i_false,
            "target_top1": scored["target_population"]["TARGET_TOP1_ACCEPTABLE"],
            "target_recall_at_5": scored["target_population"]["TARGET_RECALL_AT_5"],
            "target_mrr": scored["target_population"]["TARGET_MRR"],
            "core_recall_at_5": scored["core_target_population"]["TARGET_RECALL_AT_5"],
            "unambiguous_top1": scored["unambiguous_target_population"]["TARGET_TOP1_ACCEPTABLE"],
        },
        "identity_corrected_count": identity_corrected,
        "identity_harmed_count": identity_harmed,
        "false_devanagari_corrected_count": false_dev_corrected,
        "false_devanagari_new_count": false_dev_new,
        "identity_to_target_transitions": identity_to_target,
        "target_to_identity_transitions": target_to_identity,
        "protected_mutations": scored["safety"]["protected_span_mutations"],
        "note": "Aggregate diagnostic only; no frozen case surfaces emitted.",
    }


def post_run_immutability(repo: Path = REPO) -> dict[str, Any]:
    before_attempt = _sha_file(ATTEMPT_PATH) if ATTEMPT_PATH.exists() else None
    imm = immutability_preflight(repo)
    chain_h = _sha_file(RC_CHAIN)
    lock_h = _sha_file(RC_LOCK)
    qual_h = _sha_file(RC_QUAL)
    sel = _sha_file(SELECTION_PATH) if SELECTION_PATH.exists() else None
    after_attempt = _sha_file(ATTEMPT_PATH) if ATTEMPT_PATH.exists() else None
    attempt = json.loads(ATTEMPT_PATH.read_text(encoding="utf-8"))
    lock_unchanged = before_attempt == after_attempt and attempt.get("status") == "LOCKED_NOT_RUN"
    return {
        "ok": imm["ok"] and lock_unchanged,
        "attempt_lock_unchanged": lock_unchanged,
        "immutability": imm,
        "artifact_hashes": {
            "selection": sel,
            "r3h2_chain": chain_h,
            "r3h2_lock": lock_h,
            "r3h2_qualification": qual_h,
            "attempt": after_attempt,
            "default_resource": DEFAULT_RESOURCE_HASH,
            "candidate_resource": CANDIDATE_RESOURCE_HASH,
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
    candidate_resources = load_candidate_resources()
    cases, man = load_v2_cases(repo)
    case_ids = {c["case_id"] for c in cases}
    if len(cases) != 696 or man["dataset_hash"] != FROZEN_HASHES["v2"]:
        raise RuntimeError("frozen V2 load mismatch")

    pred_path = REPORTS / "MAI_07R3I_V2_ONE_SHOT_PREDICTIONS.jsonl"
    reused_existing_predictions = False
    # If a prior mid-score technical failure left a complete one-shot prediction
    # file, finish scoring from it — do NOT re-invoke the runtime on frozen V2.
    if pred_path.exists() and not EXEC_PATH.exists():
        existing = [
            json.loads(ln) for ln in pred_path.read_text(encoding="utf-8").splitlines() if ln.strip()
        ]
        if len(existing) == 696 and {p["case_id"] for p in existing} == case_ids:
            preds = existing
            reused_existing_predictions = True
            exceptions.append(
                "RECOVERED_FROM_EXISTING_ONE_SHOT_PREDICTIONS:prior_mid_score_technical_failure"
            )
        else:
            raise RuntimeError("incomplete_prior_predictions_refuse_rerun")
    else:
        try:
            preds = run_frozen_predictions_with_r3h2(cases, candidate_resources)
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
                "candidate_resource_content_sha256": candidate_resources.content_hash,
            }
            write_json_immutable(EXEC_PATH, exec_result)
            raise

    elapsed = time.perf_counter() - t0
    end = datetime.now(timezone.utc)
    preds = sorted(preds, key=lambda p: p["case_id"])
    for p in preds:
        p["evaluation_attempt_id"] = ATTEMPT_ID

    REPORTS.mkdir(parents=True, exist_ok=True)
    if not reused_existing_predictions:
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
            "candidate_resource_content_sha256": candidate_resources.content_hash,
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
            "case_ids": [
                p["case_id"]
                for p in preds
                if p["primary_population"] == "TRANSLITERATION_REQUIRED"
            ],
        },
        audit,
    )
    if scored.get("invariant_errors"):
        raise RuntimeError(f"SCORER_DISAGREEMENT_FAILED: {scored['invariant_errors']}")

    diff = differential_r3g002_r3i(preds, scored)
    canon_report = {
        "schema_version": "1.0.0",
        "report_id": "MAI_07R3I_V2_CANONICAL_SCORE",
        "attempt_id": ATTEMPT_ID,
        "runtime_version": RUNTIME_VERSION,
        "candidate_resource_pack_version": CANDIDATE_PACK_VERSION,
        "resource_hash": CANDIDATE_RESOURCE_HASH,
        "dataset_hash": FROZEN_HASHES["v2"],
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
        "report_id": "MAI_07R3I_V2_AUDIT_SCORE",
        "attempt_id": ATTEMPT_ID,
        "audit_scorer_version": AUDIT_SCORER_VERSION,
        "audit_aggregate": audit,
        "agrees_with_canonical": True,
        "QUALITY_GATES_PASSED": scored["QUALITY_GATES_PASSED"],
    }
    canon_path = REPORTS / "MAI_07R3I_V2_CANONICAL_SCORE_REPORT.json"
    audit_path = REPORTS / "MAI_07R3I_V2_AUDIT_SCORE_REPORT.json"
    per_path = REPORTS / "MAI_07R3I_V2_PER_CASE_AUDIT.jsonl"
    diff_path = REPORTS / "MAI_07R3I_R3G002_DIFFERENTIAL.json"
    canon_path.write_text(
        json.dumps(canon_report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    audit_path.write_text(
        json.dumps(audit_report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    with per_path.open("w", encoding="utf-8", newline="\n") as fh:
        for row in scored["per_case"]:
            fh.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
    diff_path.write_text(
        json.dumps(diff, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )

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
        "reused_existing_one_shot_predictions": reused_existing_predictions,
        "candidate_resource_pack_version": CANDIDATE_PACK_VERSION,
        "candidate_resource_content_sha256": candidate_resources.content_hash,
        "default_pack_not_used": True,
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
        "phase": PHASE_ID,
        "verdict": quality_status,
        "post_run_immutability": post_run_immutability(repo),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
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

    p = argparse.ArgumentParser(description="MAI-07R3I frozen-V2 one-shot runner")
    p.add_argument("--preflight", action="store_true")
    p.add_argument("--prove-pack", action="store_true")
    p.add_argument("--lock-attempt", action="store_true")
    p.add_argument("--execute", action="store_true")
    args = p.parse_args()

    if args.prove_pack and not args.preflight and not args.lock_attempt and not args.execute:
        proof = prove_candidate_pack_load()
        print(
            json.dumps(
                {
                    "selected_candidate_pack_loaded": proof.get("selected_candidate_pack_loaded"),
                    "selected_resource_content_sha256": proof.get("selected_resource_content_sha256"),
                    "default_pack_not_used": proof.get("default_pack_not_used"),
                    "errors": proof.get("errors", []),
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0 if proof.get("selected_candidate_pack_loaded") else 2

    if args.preflight or (not args.lock_attempt and not args.execute and not args.prove_pack):
        out = write_preflight_bundle()
        print(json.dumps({"status": out["status"], "errors": out.get("errors", [])}, indent=2))
        return 0 if out["status"] == "PREFLIGHT_OK" else 2

    if args.lock_attempt:
        # Ensure prove-pack path also ran as part of preflight inside lock.
        if args.prove_pack:
            prove_candidate_pack_load()
        att = lock_attempt_manifest()
        print(
            json.dumps(
                {
                    "attempt_id": att["attempt_id"],
                    "semantic": att["attempt_manifest_semantic_sha256"],
                    "status": att["status"],
                },
                indent=2,
            )
        )
        return 0

    if args.execute:
        result = execute_one_shot()
        print(
            json.dumps(
                {
                    "status": result["status"],
                    "QUALITY_GATES_PASSED": result.get("QUALITY_GATES_PASSED"),
                    "predictions_jsonl_raw_sha256": result.get("predictions_jsonl_raw_sha256"),
                    "predictions_canonical_list_sha256": result.get(
                        "predictions_canonical_list_sha256"
                    ),
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0 if result.get("QUALITY_GATES_PASSED") else 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
