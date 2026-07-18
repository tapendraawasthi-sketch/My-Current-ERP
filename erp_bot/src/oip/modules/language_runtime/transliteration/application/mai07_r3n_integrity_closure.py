"""MAI-07R3N-INTEGRITY-CLOSURE — forensic audit of RC_001/RC_002 holdout lineage.

Read-only forensics: does not regenerate predictions, mutate attempts, or alter
lock bodies. Writes append-only evidence under evals/mai07_r3n_integrity_closure/.
"""

from __future__ import annotations

import ast
import hashlib
import json
import os
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..infrastructure.seal_contract_v2 import (
    predictions_canonical_list_sha256,
    semantic_json_hash,
    sha256_bytes,
    sha256_file,
)
from .. import ENABLE_PROMOTION_OVERLAY, RUNTIME_VERSION
from .mai07_r3n_candidate_runtime import (
    CANDIDATE_PACK_DIR,
    CANDIDATE_POLICY_VERSION,
    CANDIDATE_RUNTIME_VERSION,
    PARENT_RESOURCE_HASH,
    PARENT_RUNTIME_VERSION,
    assert_active_default_immutable,
)
from .rc_lock_chain import compute_rc_raw_file_sha256, compute_rc_semantic_body_sha256

REPO = Path(__file__).resolve().parents[7]
R3N_OUT = REPO / "evals" / "mai07_r3n_policy_conformance"
CLOSURE_OUT = REPO / "evals" / "mai07_r3n_integrity_closure"
AUTHORIZE_ENV = "MAI07_AUTHORIZE_EVAL_WRITE"

RC001 = "MAI_07R3N_POLICY_CONFORMANCE_RELEASE_CANDIDATE_001"
RC002 = "MAI_07R3N_POLICY_CONFORMANCE_RELEASE_CANDIDATE_002"
ATTEMPT001 = "MAI_07R3N_HOLDOUT_ATTEMPT_001"
ATTEMPT002 = "MAI_07R3N_HOLDOUT_ATTEMPT_002"

# Known Attempt-001 romanized surface recovered from builder history; used only
# to reconstruct the holdout bytes whose SHA matches RC_001 lock claim.
_ATTEMPT001_ROMANIZED_RECONSTRUCTION = {
    "case_id": "R3N-HLD-0002-75481ef5",
    "highlighted_span": "sulka",
    "input_text": "aaja sulka ko record hernu r3n hld rom 0001",
}

EXPECTED_RC001_HOLDOUT_SHA = "c5a472c48836fdfeec7aac2dcaa36dffbf72616ad05195b12b0a35d12f83371b"
EXPECTED_RC002_HOLDOUT_SHA = "192dd0812a919e17ab3654f600ced33be9b5dc6e0ab9112da60089c75744b4d7"
EXPECTED_RC002_LOCK_SEMANTIC = "539ea32caa270060c9de28b35e989cb7bd6a1ade9670264b8e143977b0d3b24a"
EXPECTED_THRESHOLDS_SHA = "afda869b4b1ea7ced66a98a3a927586d34b07b820e6c4049fb0dd849e38ae044"
EXPECTED_PACK_SHA = "4bbd3e97c99bf769e58924fc6a8d8a7de943db63700d2bdabf02b31236dd0d8c"

APP = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
INFRA = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure"
RES = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration/resources"

SOURCE_FILES = {
    "canonical_scorer": APP / "eval_mai07_r3n_canonical_scorer.py",
    "audit_scorer": APP / "eval_mai07_r3n_audit_scorer.py",
    "scoring_contracts": APP / "r3n_scoring_contracts.py",
    "candidate_runtime": APP / "mai07_r3n_candidate_runtime.py",
    "eval_runner": APP / "eval_mai07_r3n.py",
    "dataset_builder": APP / "mai07_r3n_dataset_builder.py",
    "english_identity_guard": INFRA / "english_identity_guard.py",
    "r3n_policy": RES / "r3n_policy_conformance_policy.json",
    "pack_builder": APP / "build_mai07r3n_pack.py",
}


def _require_write() -> None:
    if os.environ.get(AUTHORIZE_ENV) != "1":
        raise PermissionError(f"Set {AUTHORIZE_ENV}=1 to write integrity-closure artifacts")


def _write_json(path: Path, obj: Any) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")
    return sha256_file(path)


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(ln) for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]


def _norm_text(text: str) -> str:
    return " ".join(text.lower().split())


def _text_hash(text: str) -> str:
    return hashlib.sha256(_norm_text(text).encode("utf-8")).hexdigest()


def _jsonl_bytes(rows: list[dict[str, Any]]) -> bytes:
    lines = [json.dumps(r, ensure_ascii=False, sort_keys=True, separators=(",", ":")) for r in rows]
    return ("\n".join(lines) + ("\n" if lines else "")).encode("utf-8")


def _file_meta(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"path": str(path.as_posix() if path.is_absolute() else path), "exists": False}
    raw = path.read_bytes()
    rel = path.relative_to(REPO).as_posix() if path.is_relative_to(REPO) else str(path)
    meta: dict[str, Any] = {
        "path": rel,
        "exists": True,
        "byte_length": len(raw),
        "raw_sha256": sha256_bytes(raw),
        "mtime_utc": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
    }
    if path.suffix == ".json":
        try:
            obj = json.loads(raw.decode("utf-8"))
            meta["semantic_sha256"] = semantic_json_hash(obj)
            if isinstance(obj, dict):
                meta["schema_version"] = obj.get("schema_version") or obj.get("schema")
                meta["record_type"] = obj.get("record_type") or obj.get("status")
                meta["attempt_id"] = obj.get("attempt_id")
                meta["rc_id"] = obj.get("rc_id") or obj.get("manifest_id")
                meta["created_utc"] = obj.get("created_utc") or obj.get("locked_utc")
        except Exception as exc:  # noqa: BLE001 — forensic: capture parse failure
            meta["json_parse_error"] = str(exc)
    elif path.suffix == ".jsonl":
        rows = _load_jsonl(path)
        meta["row_count"] = len(rows)
        meta["semantic_sha256"] = predictions_canonical_list_sha256(rows) if rows else sha256_bytes(b"[]")
        if rows and "case_id" in rows[0]:
            meta["case_id_set_sha256"] = sha256_bytes(
                canonical_case_set_bytes(rows)
            )
            meta["template_family_set_sha256"] = sha256_bytes(
                "|".join(sorted({r.get("template_family", "") for r in rows})).encode()
            )
            meta["text_set_sha256"] = sha256_bytes(
                "|".join(sorted(_text_hash(r.get("input_text", "")) for r in rows)).encode()
            )
    return meta


def canonical_case_set_bytes(rows: list[dict[str, Any]]) -> bytes:
    ids = sorted({r["case_id"] for r in rows if "case_id" in r})
    return ("\n".join(ids) + "\n").encode("utf-8")


def reconstruct_attempt001_holdout(current_holdout: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Reconstruct Attempt-001 HOLDOUT bytes from current file + known romanized revert.

    Proven when reconstructed raw SHA-256 equals RC_001 lock's HOLDOUT_VALIDATION sha256.
    """
    out: list[dict[str, Any]] = []
    for row in current_holdout:
        c = deepcopy(row)
        if c.get("case_id") == _ATTEMPT001_ROMANIZED_RECONSTRUCTION["case_id"]:
            c["highlighted_span"] = _ATTEMPT001_ROMANIZED_RECONSTRUCTION["highlighted_span"]
            c["input_text"] = _ATTEMPT001_ROMANIZED_RECONSTRUCTION["input_text"]
        out.append(c)
    return out


def snapshot_forensics() -> dict[str, Any]:
    assert_active_default_immutable()
    files: dict[str, Any] = {}
    # RC / attempt / chain / thresholds / datasets / reports
    names = [
        f"{RC001}.LOCKED_NOT_RUN.json",
        f"{RC001}.LOCK_RECORD.json",
        f"{RC001}.CHAIN_MANIFEST.json",
        f"{RC001}.QUALIFICATION_RESULT.json",
        f"{RC002}.LOCKED_NOT_RUN.json",
        f"{RC002}.LOCK_RECORD.json",
        f"{RC002}.CHAIN_MANIFEST.json",
        f"{RC002}.QUALIFICATION_RESULT.json",
        f"{ATTEMPT001}.json",
        f"{ATTEMPT002}.json",
        "MAI_07R3N_THRESHOLDS.json",
        "MANIFEST.json",
        "LEAKAGE_AND_SPLIT_INTEGRITY.json",
        "development.jsonl",
        "holdout_validation.jsonl",
        "safety_challenge.jsonl",
        "context_counterfactual.jsonl",
        "oov_challenge.jsonl",
        "monotonic_regression.jsonl",
        "reports/holdout_validation_predictions.jsonl",
        "reports/holdout_validation_score_report.json",
        "reports/development_predictions.jsonl",
        "reports/development_score_report.json",
        "reports/IMMUTABILITY_REPORT.json",
    ]
    for name in names:
        files[name] = _file_meta(R3N_OUT / name)
    for key, path in SOURCE_FILES.items():
        files[f"source:{key}"] = _file_meta(path)
    # Candidate pack
    pack_files = {}
    if CANDIDATE_PACK_DIR.is_dir():
        for p in sorted(CANDIDATE_PACK_DIR.iterdir()):
            if p.is_file():
                pack_files[p.name] = sha256_file(p)
        man = _load_json(CANDIDATE_PACK_DIR / "manifest.json") if (CANDIDATE_PACK_DIR / "manifest.json").is_file() else {}
        files["candidate_pack"] = {
            "path": CANDIDATE_PACK_DIR.relative_to(REPO).as_posix(),
            "content_hash_claimed": man.get("content_hash"),
            "file_hashes": pack_files,
            "version": man.get("version") or CANDIDATE_RUNTIME_VERSION,
        }
    snap = {
        "schema_version": "mai07_r3n_integrity_closure_forensic_snapshot_v1",
        "phase": "MAI-07R3N-INTEGRITY-CLOSURE",
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "prohibited_for_training": True,
        "no_runtime_prediction_rerun": True,
        "active_runtime": RUNTIME_VERSION,
        "active_runtime_expected": PARENT_RUNTIME_VERSION,
        "overlay_enabled": ENABLE_PROMOTION_OVERLAY,
        "parent_resource_hash": PARENT_RESOURCE_HASH,
        "candidate_runtime_version": CANDIDATE_RUNTIME_VERSION,
        "candidate_policy_version": CANDIDATE_POLICY_VERSION,
        "files": files,
        "expected_anchors": {
            "rc001_holdout_sha256": EXPECTED_RC001_HOLDOUT_SHA,
            "rc002_holdout_sha256": EXPECTED_RC002_HOLDOUT_SHA,
            "rc002_lock_semantic_sha256": EXPECTED_RC002_LOCK_SEMANTIC,
            "thresholds_sha256": EXPECTED_THRESHOLDS_SHA,
            "pack_content_sha256": EXPECTED_PACK_SHA,
        },
    }
    return snap


def _holdout_surface_hashes(rows: list[dict[str, Any]]) -> dict[str, str]:
    raw = sha256_bytes(_jsonl_bytes(rows))
    # Canonical semantic = sorted case records without path-local noise; use prediction-style list hash of
    # {case_id, input_text, highlighted_span, template_family, population_ids} for set-stable comparison.
    canon_rows = [
        {
            "case_id": r["case_id"],
            "highlighted_span": r.get("highlighted_span"),
            "input_text": r.get("input_text"),
            "population_ids": sorted(r.get("population_ids") or []),
            "template_family": r.get("template_family"),
        }
        for r in sorted(rows, key=lambda x: x["case_id"])
    ]
    return {
        "raw_sha256": raw,
        "canonical_semantic_sha256": predictions_canonical_list_sha256(canon_rows),
        "case_id_set_sha256": sha256_bytes(canonical_case_set_bytes(rows)),
        "normalized_text_set_sha256": sha256_bytes(
            ("\n".join(sorted(_text_hash(r.get("input_text", "")) for r in rows)) + "\n").encode()
        ),
        "template_family_set_sha256": sha256_bytes(
            ("\n".join(sorted({r.get("template_family", "") for r in rows})) + "\n").encode()
        ),
    }


def holdout_reuse_audit() -> dict[str, Any]:
    current = _load_jsonl(R3N_OUT / "holdout_validation.jsonl")
    a1 = reconstruct_attempt001_holdout(current)
    a1_raw = sha256_bytes(_jsonl_bytes(a1))
    a2_raw = sha256_file(R3N_OUT / "holdout_validation.jsonl")
    lock1 = _load_json(R3N_OUT / f"{RC001}.LOCKED_NOT_RUN.json")
    lock2 = _load_json(R3N_OUT / f"{RC002}.LOCKED_NOT_RUN.json")
    claimed1 = lock1["dataset_manifest"]["splits"]["HOLDOUT_VALIDATION"]["sha256"]
    claimed2 = lock2["dataset_manifest"]["splits"]["HOLDOUT_VALIDATION"]["sha256"]

    ids1 = {r["case_id"] for r in a1}
    ids2 = {r["case_id"] for r in current}
    texts1 = {_text_hash(r["input_text"]) for r in a1}
    texts2 = {_text_hash(r["input_text"]) for r in current}
    # Map text hash -> case_id for shared reporting without dumping long bodies in every field
    text_to_case_a1 = {_text_hash(r["input_text"]): r["case_id"] for r in a1}
    text_to_case_a2 = {_text_hash(r["input_text"]): r["case_id"] for r in current}
    fam1 = {r["template_family"] for r in a1}
    fam2 = {r["template_family"] for r in current}
    pops1 = {p for r in a1 for p in r.get("population_ids") or []}
    pops2 = {p for r in current for p in r.get("population_ids") or []}

    attempt1 = _load_json(R3N_OUT / f"{ATTEMPT001}.json")
    attempt2 = _load_json(R3N_OUT / f"{ATTEMPT002}.json")
    current_pred_raw = sha256_file(R3N_OUT / "reports" / "holdout_validation_predictions.jsonl")

    seed1 = lock1["dataset_manifest"]["seeds"]
    seed2 = lock2["dataset_manifest"]["seeds"]
    shared_ids = sorted(ids1 & ids2)
    shared_texts = sorted(texts1 & texts2)
    shared_fams = sorted(fam1 & fam2)

    return {
        "schema_version": "mai07_r3n_holdout_reuse_audit_v2",
        "attempt001_holdout_hashes": _holdout_surface_hashes(a1),
        "attempt002_holdout_hashes": _holdout_surface_hashes(current),
        "attempt001_holdout_raw_sha256_reconstructed": a1_raw,
        "attempt001_holdout_raw_sha256_claimed_in_rc001_lock": claimed1,
        "attempt001_reconstruction_matches_rc001_lock": a1_raw == claimed1,
        "attempt002_holdout_raw_sha256_on_disk": a2_raw,
        "attempt002_holdout_raw_sha256_claimed_in_rc002_lock": claimed2,
        "attempt002_on_disk_matches_rc002_lock": a2_raw == claimed2,
        "holdout_hash_equal": a1_raw == a2_raw,
        "holdout_semantic_equal": (
            _holdout_surface_hashes(a1)["canonical_semantic_sha256"]
            == _holdout_surface_hashes(current)["canonical_semantic_sha256"]
        ),
        "exact_case_reuse_count": len(shared_ids),
        "exact_case_union_count": len(ids1 | ids2),
        "shared_case_ids": shared_ids,
        "exact_text_reuse_count": len(shared_texts),
        "shared_normalized_text_hashes": shared_texts,
        "shared_normalized_text_case_ids": sorted(
            {text_to_case_a1[h] for h in shared_texts if h in text_to_case_a1}
        ),
        "exact_text_only_attempt001": len(texts1 - texts2),
        "exact_text_only_attempt002": len(texts2 - texts1),
        "text_only_attempt001_case_ids": sorted(
            text_to_case_a1[h] for h in (texts1 - texts2) if h in text_to_case_a1
        ),
        "text_only_attempt002_case_ids": sorted(
            text_to_case_a2[h] for h in (texts2 - texts1) if h in text_to_case_a2
        ),
        "template_family_overlap_count": len(shared_fams),
        "template_family_overlap": shared_fams,
        "shared_template_families": shared_fams,
        "population_overlap_count": len(pops1 & pops2),
        "population_overlap": sorted(pops1 & pops2),
        "same_builder_seed_family": seed1 == seed2,
        "seeds": {"rc001": seed1, "rc002": seed2},
        "builder_version_same": (
            lock1["dataset_manifest"]["builder_version"] == lock2["dataset_manifest"]["builder_version"]
        ),
        "attempt002_executed_same_eight_holdout_case_ids": ids1 == ids2 and len(ids2) == 8,
        "predictions_generated_against_same_cases": ids1 == ids2,
        "reused_cases_already_had_attempt001_predictions": ids1 == ids2 and attempt1.get("prediction_count") == 8,
        "attempt001_prediction_raw_sha256": attempt1["predictions_jsonl_raw_sha256"],
        "attempt002_prediction_raw_sha256": attempt2["predictions_jsonl_raw_sha256"],
        "attempt001_prediction_semantic_sha256": attempt1["predictions_canonical_list_sha256"],
        "attempt002_prediction_semantic_sha256": attempt2["predictions_canonical_list_sha256"],
        "current_prediction_file_matches_attempt002": current_pred_raw
        == attempt2["predictions_jsonl_raw_sha256"],
        "attempt001_prediction_file_overwritten": current_pred_raw
        != attempt1["predictions_jsonl_raw_sha256"],
        "classification": (
            "HOLDOUT_CONTAMINATED"
            if (ids1 == ids2 and len(fam1 & fam2) == len(fam1) == len(fam2) and seed1 == seed2)
            else "HOLDUTS_DISTINCT"
        ),
        "notes": (
            "Attempt 002 holdout differs by exactly one romanized sentence body "
            "(sulka→garna) under identical case IDs, template families, and seed family. "
            "Changing attempt ID does not create an independent holdout. "
            "All eight case IDs already produced Attempt 001 predictions before Attempt 002."
        ),
    }


def gate_semantics_audit() -> dict[str, Any]:
    q1 = _load_json(R3N_OUT / f"{RC001}.QUALIFICATION_RESULT.json")
    q2 = _load_json(R3N_OUT / f"{RC002}.QUALIFICATION_RESULT.json")
    m1 = q1["metrics_summary"]["authorized_code_corrective"]
    m2 = q2["metrics_summary"]["authorized_code_corrective"]
    thr = sha256_file(R3N_OUT / "MAI_07R3N_THRESHOLDS.json")
    contracts = sha256_file(SOURCE_FILES["scoring_contracts"])
    can = sha256_file(SOURCE_FILES["canonical_scorer"])
    aud = sha256_file(SOURCE_FILES["audit_scorer"])

    transition = (
        m1.get("applicability") == "INVALID_REQUIRED_POPULATION"
        and m2.get("applicability") == "NOT_APPLICABLE"
    )
    return {
        "schema_version": "mai07_r3n_gate_semantics_audit_v1",
        "authorized_code_corrective": {
            "rc001": {
                "applicability": m1.get("applicability"),
                "denominator": m1.get("denominator"),
                "numerator": m1.get("numerator"),
                "notes": m1.get("notes"),
                "population_id": m1.get("population_id"),
            },
            "rc002": {
                "applicability": m2.get("applicability"),
                "denominator": m2.get("denominator"),
                "numerator": m2.get("numerator"),
                "notes": m2.get("notes"),
                "population_id": m2.get("population_id"),
            },
            "transition_empty_required_to_not_applicable": transition,
            "classification": (
                "POST_OBSERVATION_GATE_SEMANTICS_CHANGE" if transition else "NO_EMPTY_REQUIRED_TRANSITION"
            ),
        },
        "threshold_manifest_raw_sha256": thr,
        "threshold_hash_unchanged_vs_expected": thr == EXPECTED_THRESHOLDS_SHA,
        "note_threshold_hash_does_not_bind_scorer": True,
        "current_scorer_source_hashes": {
            "scoring_contracts": contracts,
            "canonical_scorer": can,
            "audit_scorer": aud,
        },
        "rc_locks_bind_scorer_hashes": False,
        "rc_locks_bind_population_requiredness": False,
        "metric_required_when_empty_present_in_contracts": "metric_required_when_empty"
        in SOURCE_FILES["scoring_contracts"].read_text(encoding="utf-8"),
        "scorer_version_string_unchanged": "mai-07-r3n.scorer.1.0.0",
        "finding": (
            "After Attempt 001 observed INVALID_REQUIRED_POPULATION for "
            "authorized_code_corrective on HOLDOUT, scorer requiredness was changed so "
            "empty populations on non-DEVELOPMENT splits become NOT_APPLICABLE. "
            "Threshold JSON hash alone does not prove unchanged gate semantics."
        ),
    }


def runtime_semantic_diff() -> dict[str, Any]:
    """Document post-Attempt-001 runtime/protocol changes (forensic, no git rewrite)."""
    runtime_src = SOURCE_FILES["candidate_runtime"].read_text(encoding="utf-8")
    has_coalesce = "coalesce_structural_identifiers" in runtime_src
    contracts_src = SOURCE_FILES["scoring_contracts"].read_text(encoding="utf-8")
    has_required_helper = "metric_required_when_empty" in contracts_src
    builder_src = SOURCE_FILES["dataset_builder"].read_text(encoding="utf-8")
    has_garna = "garna" in builder_src and "sulka" not in builder_src

    lock1 = _load_json(R3N_OUT / f"{RC001}.LOCKED_NOT_RUN.json")
    lock2 = _load_json(R3N_OUT / f"{RC002}.LOCKED_NOT_RUN.json")
    same_candidate_version = (
        lock1.get("runtime_claim") == lock2.get("runtime_claim") == CANDIDATE_RUNTIME_VERSION
    )
    same_pack = lock1.get("resource_content_sha256") == lock2.get("resource_content_sha256")

    changes = [
        {
            "file": "mai07_r3n_candidate_runtime.py",
            "semantic_change": "Added coalesce_structural_identifiers for letter-digit-separator codes",
            "stated_reason": "Attempt 001 identifier span_found=false (SKU-44102 / ORD/8844/X)",
            "responds_to_attempt001": True,
            "changes_runtime_behavior": True,
            "changes_scoring_behavior": False,
            "changes_gate_requiredness": False,
            "present_now": has_coalesce,
        },
        {
            "file": "r3n_scoring_contracts.py / eval_mai07_r3n_*_scorer.py",
            "semantic_change": "Empty populations optional on non-DEVELOPMENT → NOT_APPLICABLE",
            "stated_reason": "Attempt 001 authorized_code_corrective INVALID_REQUIRED_POPULATION",
            "responds_to_attempt001": True,
            "changes_runtime_behavior": False,
            "changes_scoring_behavior": True,
            "changes_gate_requiredness": True,
            "present_now": has_required_helper,
        },
        {
            "file": "mai07_r3n_dataset_builder.py / holdout_validation.jsonl",
            "semantic_change": "Romanized holdout span sulka→garna under same case_id/template_family/seed",
            "stated_reason": "Attempt 001 romanized_script_at_5 0/1 (sulka IDENTITY_ONLY)",
            "responds_to_attempt001": True,
            "changes_runtime_behavior": False,
            "changes_scoring_behavior": False,
            "changes_gate_requiredness": False,
            "changes_holdout_body": True,
            "present_now": has_garna,
        },
        {
            "file": "eval_mai07_r3n.py",
            "semantic_change": "RC_ID advanced 001→002; attempt_id 001→002; same candidate version string",
            "stated_reason": "Attempt 001 chain consumed; new lock required",
            "responds_to_attempt001": True,
            "changes_runtime_behavior": False,
            "changes_scoring_behavior": False,
            "changes_gate_requiredness": False,
        },
    ]
    return {
        "schema_version": "mai07_r3n_runtime_semantic_diff_v1",
        "candidate_runtime_version_rc001": lock1.get("runtime_claim"),
        "candidate_runtime_version_rc002": lock2.get("runtime_claim"),
        "candidate_version_reused": same_candidate_version,
        "pack_content_hash_rc001": lock1.get("resource_content_sha256"),
        "pack_content_hash_rc002": lock2.get("resource_content_sha256"),
        "pack_hash_reused": same_pack,
        "classification": (
            "CANDIDATE_VERSION_REUSED_AFTER_SEMANTIC_CHANGE"
            if same_candidate_version and any(c.get("changes_runtime_behavior") for c in changes)
            else "VERSIONED_CORRECTLY"
        ),
        "post_attempt001_changes": changes,
        "attempt001_exposed": {
            "individual_case_predictions": True,
            "individual_case_text_in_dataset": True,
            "individual_failure_reasons": True,
            "aggregate_failures": True,
            "missing_coalescing_behavior": True,
            "weak_romanized_examples": True,
            "empty_population_behavior": True,
        },
    }


def denominator_adequacy_audit() -> dict[str, Any]:
    thr = _load_json(R3N_OUT / "MAI_07R3N_THRESHOLDS.json")
    q2 = _load_json(R3N_OUT / f"{RC002}.QUALIFICATION_RESULT.json")
    holdout_metrics = q2.get("metrics_summary") or {}
    dens = {
        mid: (m.get("denominator") if isinstance(m, dict) else None)
        for mid, m in holdout_metrics.items()
        if mid != "split_expected_pass"
    }
    min_declared = thr.get("minimum_denominators") or thr.get("locked_minimum_denominators")
    holdout = _load_jsonl(R3N_OUT / "holdout_validation.jsonl")
    lane_pops = {
        "ENGLISH_IDENTITY_GUARD_analogue": sum(
            1 for r in holdout if "ENGLISH_IDENTITY_REQUIRED" in (r.get("population_ids") or [])
        ),
        "IDENTITY_CANDIDATE_INVARIANT_analogue": sum(
            1 for r in holdout if "IDENTITY_RETENTION_REQUIRED" in (r.get("population_ids") or [])
        ),
        "ACRONYM_OR_IDENTIFIER_PROTECTION_analogue": sum(
            1
            for r in holdout
            if set(r.get("population_ids") or [])
            & {"ACRONYM_IDENTITY_REQUIRED", "IDENTIFIER_PROTECTION_REQUIRED"}
        ),
    }
    one_case_pops = [k for k, d in dens.items() if d == 1]
    return {
        "schema_version": "mai07_r3n_denominator_adequacy_audit_v1",
        "threshold_declares_minimum_denominators": min_declared is not None,
        "minimum_denominators_value": min_declared,
        "classification_missing_policy": (
            "MINIMUM_DENOMINATOR_POLICY_MISSING" if min_declared is None else "MINIMUMS_DECLARED"
        ),
        "holdout_metric_denominators": dens,
        "one_case_populations": one_case_pops,
        "authorized_code_corrective_denominator_on_holdout": dens.get("authorized_code_corrective"),
        "corrective_lane_holdout_analogue_counts": lane_pops,
        "corrective_lane_coverage_classification": (
            "CORRECTIVE_LANE_HOLDOUT_COVERAGE_INSUFFICIENT"
            if any(v < 75 for v in lane_pops.values())
            else "ADEQUATE"
        ),
        "note": (
            "1/1 denominators may be technically non-empty but were not predeclared as adequate "
            "corrective-RC authority. AUTHORIZED_CODE_CORRECTIVE remained 0/0 on holdout."
        ),
    }


def timeline() -> dict[str, Any]:
    a1 = _load_json(R3N_OUT / f"{ATTEMPT001}.json")
    a2 = _load_json(R3N_OUT / f"{ATTEMPT002}.json")
    q1 = _load_json(R3N_OUT / f"{RC001}.QUALIFICATION_RESULT.json")
    q2 = _load_json(R3N_OUT / f"{RC002}.QUALIFICATION_RESULT.json")
    lock1 = _load_json(R3N_OUT / f"{RC001}.LOCKED_NOT_RUN.json")
    lock2 = _load_json(R3N_OUT / f"{RC002}.LOCKED_NOT_RUN.json")
    events = [
        {
            "seq": 1,
            "event": "RC_001_LOCKED_NOT_RUN",
            "bound_lock_semantic_sha256": a1["parent_lock_semantic_sha256"],
            "bound_lock_raw_sha256": a1["parent_lock_raw_sha256"],
            "holdout_dataset_sha256": lock1["dataset_manifest"]["splits"]["HOLDOUT_VALIDATION"]["sha256"],
            "candidate_runtime": lock1.get("runtime_claim"),
            "pack_hash": lock1.get("resource_content_sha256"),
        },
        {
            "seq": 2,
            "event": "ATTEMPT_001_EXECUTED",
            "created_utc": a1["created_utc"],
            "attempt_id": ATTEMPT001,
            "prediction_raw_sha256": a1["predictions_jsonl_raw_sha256"],
            "prediction_semantic_sha256": a1["predictions_canonical_list_sha256"],
        },
        {
            "seq": 3,
            "event": "ATTEMPT_001_CLOSEOUT",
            "created_utc": q1.get("created_utc"),
            "verdict": q1.get("engineering_verdict") or q1.get("status"),
            "authorized_code_corrective_applicability": q1["metrics_summary"]["authorized_code_corrective"].get(
                "applicability"
            ),
        },
        {
            "seq": 4,
            "event": "POST_ATTEMPT001_RUNTIME_AND_PROTOCOL_CHANGES",
            "changes": [
                "coalesce_structural_identifiers",
                "metric_required_when_empty / NOT_APPLICABLE for empty non-DEV pops",
                "holdout romanized sulka→garna",
                "RC_ID→002 under same candidate version string",
            ],
            "bound_evidence": "RUNTIME_SEMANTIC_DIFF.json",
        },
        {
            "seq": 5,
            "event": "RC_002_LOCKED_NOT_RUN",
            "bound_lock_semantic_sha256": a2["parent_lock_semantic_sha256"],
            "bound_lock_raw_sha256": a2["parent_lock_raw_sha256"],
            "holdout_dataset_sha256": lock2["dataset_manifest"]["splits"]["HOLDOUT_VALIDATION"]["sha256"],
            "candidate_runtime": lock2.get("runtime_claim"),
            "pack_hash": lock2.get("resource_content_sha256"),
        },
        {
            "seq": 6,
            "event": "ATTEMPT_002_EXECUTED",
            "created_utc": a2["created_utc"],
            "attempt_id": ATTEMPT002,
            "prediction_raw_sha256": a2["predictions_jsonl_raw_sha256"],
            "prediction_semantic_sha256": a2["predictions_canonical_list_sha256"],
        },
        {
            "seq": 7,
            "event": "ATTEMPT_002_CLOSEOUT",
            "created_utc": q2.get("created_utc"),
            "verdict": q2.get("engineering_verdict") or q2.get("status"),
            "authorized_code_corrective_applicability": q2["metrics_summary"]["authorized_code_corrective"].get(
                "applicability"
            ),
        },
    ]
    return {
        "schema_version": "mai07_r3n_attempt_timeline_v1",
        "events": events,
        "lock_before_attempt001": True,
        "lock_before_attempt002": True,
        "runtime_changed_between_attempts": True,
        "scorer_changed_between_attempts": True,
        "holdout_seed_family_unchanged": True,
    }


def validity_decision(
    *,
    reuse: dict[str, Any],
    gates: dict[str, Any],
    runtime: dict[str, Any],
    dens: dict[str, Any],
) -> dict[str, Any]:
    reasons: list[str] = []
    if reuse.get("classification") == "HOLDOUT_CONTAMINATED":
        reasons.append("HOLDOUT_CONTAMINATED")
    if gates["authorized_code_corrective"].get("classification") == "POST_OBSERVATION_GATE_SEMANTICS_CHANGE":
        reasons.append("POST_OBSERVATION_GATE_SEMANTICS_CHANGE")
    if runtime.get("classification") == "CANDIDATE_VERSION_REUSED_AFTER_SEMANTIC_CHANGE":
        reasons.append("CANDIDATE_VERSION_REUSED_AFTER_SEMANTIC_CHANGE")
    if dens.get("classification_missing_policy") == "MINIMUM_DENOMINATOR_POLICY_MISSING":
        reasons.append("MINIMUM_DENOMINATOR_POLICY_MISSING")
    if dens.get("corrective_lane_coverage_classification") == "CORRECTIVE_LANE_HOLDOUT_COVERAGE_INSUFFICIENT":
        reasons.append("CORRECTIVE_LANE_HOLDOUT_COVERAGE_INSUFFICIENT")

    # Primary: contamination (runtime tuned after Attempt 001 then overlapping holdout rerun)
    primary = "INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED"
    if "HOLDOUT_CONTAMINATED" not in reasons and "POST_OBSERVATION_GATE_SEMANTICS_CHANGE" in reasons:
        primary = "INVALIDATED_GATE_SEMANTICS_CHANGE_NEW_RC_REQUIRED"
    elif "HOLDOUT_CONTAMINATED" not in reasons and "CORRECTIVE_LANE_HOLDOUT_COVERAGE_INSUFFICIENT" in reasons:
        primary = "INVALIDATED_INSUFFICIENT_HOLDOUT_AUTHORITY_NEW_RC_REQUIRED"

    return {
        "schema_version": "mai07_r3n_rc002_validity_decision_v1",
        "primary_verdict": primary,
        "secondary_reasons": reasons,
        "passed_corrective_rc_remains_valid": False,
        "rc002_historical_status": "INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED",
        "candidate_promoted": False,
        "candidate_not_eligible_for_frozen_v3": True,
        "QUALITY_GATES_PASSED": False,
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "MAI-07": "NEEDS_CORRECTIVE_WORK",
        "MAI-08": "NOT_STARTED",
        "next_governed_phase": "MAI-07R3N2-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE",
        "rationale": (
            "Attempt 001 exposed individual holdout failures (identifier coalesce gap, weak "
            "romanized synthetic, empty-required gate). Runtime/scorer/dataset were then changed "
            "and Attempt 002 reran the same case-ID set / template-family set / seed family "
            f"(exact_case_reuse={reuse.get('exact_case_reuse_count')}, "
            f"template_family_overlap={reuse.get('template_family_overlap_count')}, "
            f"exact_text_reuse={reuse.get('exact_text_reuse_count')}). "
            "Candidate version string mai-07.1.6-r3n-policyconf was reused after semantic "
            "runtime change. authorized_code_corrective transitioned "
            "EMPTY_REQUIRED→NOT_APPLICABLE after observation. Minimum denominators were not "
            "predeclared; lane analogues are 1-case populations."
        ),
    }


def r3n2_protocol_spec() -> dict[str, Any]:
    return {
        "schema_version": "mai07_r3n2_fresh_holdout_protocol_v1",
        "phase_id": "MAI-07R3N2-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE",
        "status": "SPECIFICATION_ONLY_NOT_EXECUTED",
        "parent_invalidated_rc": RC002,
        "parent_invalidation_reason": "INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED",
        "requirements": {
            "new_candidate_runtime_version": True,
            "explicit_parent_rc002_invalidation_lineage": True,
            "fresh_development_if_needed": True,
            "fresh_holdout_without_reading_old_holdout_predictions": True,
            "new_split_seed": True,
            "new_template_families": True,
            "no_exact_or_family_overlap_with_r3n_holdouts": True,
            "bind_scorer_population_threshold_runtime_pack_hashes_into_lock": True,
            "physical_locked_not_run_before_holdout": True,
            "one_attempt_only": True,
            "no_post_observation_scorer_or_gate_edits": True,
            "required_populations_never_become_not_applicable": True,
            "empty_or_below_minimum_required_population": "BLOCKED_INSUFFICIENT_POPULATION",
        },
        "minimum_required_holdout_coverage_locked_before_execution": {
            "decisive_english_identity": 200,
            "romanized_nepali_behavior": 200,
            "identity_retention_cap_pressure": 150,
            "acronym_identity": 100,
            "structural_identifiers": 100,
            "protected_identity": 100,
            "shared_ambiguous_safety": 150,
            "context_counterfactual_pairs": 150,
            "oov": 100,
            "monotonic_parent_correct": 300,
            "independent_analogue_ENGLISH_IDENTITY_GUARD": 100,
            "independent_analogue_IDENTITY_CANDIDATE_INVARIANT": 100,
            "independent_analogue_ACRONYM_OR_IDENTIFIER_PROTECTION": 75,
        },
        "population_overlap_policy": "allowed_when_honestly_declared_with_persisted_denominators_and_overlap",
        "execute_in_this_phase": False,
    }


def invalidation_sidecar(decision: dict[str, Any]) -> dict[str, Any]:
    lock2_path = R3N_OUT / f"{RC002}.LOCKED_NOT_RUN.json"
    lock2_body = _load_json(lock2_path)
    return {
        "schema_version": "mai07_r3n_historical_invalidation_sidecar_v2",
        "record_type": "HISTORICAL_INVALIDATION_SIDECAR",
        "target_rc_id": RC002,
        "target_lock_path": lock2_path.relative_to(REPO).as_posix(),
        "target_lock_raw_sha256": compute_rc_raw_file_sha256(lock2_path),
        "target_lock_semantic_sha256": compute_rc_semantic_body_sha256(lock2_body),
        "raw_file_hash_is_lock_authority": False,
        "lock_chain_semantic_integrity": True,
        "lock_body_post_closeout_mutation": False,
        "invalidation_verdict": decision["primary_verdict"],
        "secondary_reasons": decision["secondary_reasons"],
        "original_lock_body_mutated": False,
        "original_attempt_bodies_mutated": False,
        "original_prediction_files_mutated": False,
        "candidate_promoted": False,
        "candidate_not_eligible_for_frozen_v3": True,
        "passed_corrective_rc_withdrawn": True,
        "do_not_restore_passed_corrective_rc": True,
        "reuse_of_either_holdout_in_future_release_decision": False,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "prohibited_for_training": True,
    }


# --- Hardening validators (reject contamination patterns) ---

def reject_same_holdout_after_runtime_change(
    *,
    holdout_sha_a: str,
    holdout_sha_b: str,
    runtime_changed: bool,
    case_overlap: int,
    family_overlap: int,
    case_union: int,
) -> None:
    if runtime_changed and (
        holdout_sha_a == holdout_sha_b or (case_union > 0 and case_overlap == case_union and family_overlap > 0)
    ):
        raise ValueError("REJECTED:same_holdout_or_full_family_overlap_after_runtime_change")


def reject_required_to_not_applicable(before: str, after: str) -> None:
    if before == "INVALID_REQUIRED_POPULATION" and after == "NOT_APPLICABLE":
        raise ValueError("REJECTED:required_population_became_not_applicable")


def reject_candidate_version_reuse(*, version_a: str, version_b: str, runtime_changed: bool) -> None:
    if runtime_changed and version_a == version_b:
        raise ValueError("REJECTED:candidate_version_reused_after_semantic_change")


def reject_lock_missing_bindings(lock_body: dict[str, Any]) -> None:
    required = (
        "scorer_source_sha256",
        "population_contract_sha256",
        "minimum_denominators",
        "threshold_manifest_sha256",
    )
    missing = [k for k in required if k not in lock_body and k not in (lock_body.get("threshold_manifest") or {})]
    # Historical R3N locks intentionally lack these — validator for future R3N2.
    if missing:
        raise ValueError(f"REJECTED:lock_missing_bindings:{','.join(missing)}")


def run_closure(*, write: bool = True) -> dict[str, Any]:
    assert_active_default_immutable()
    if write:
        _require_write()
        CLOSURE_OUT.mkdir(parents=True, exist_ok=True)

    snap = snapshot_forensics()
    reuse = holdout_reuse_audit()
    gates = gate_semantics_audit()
    runtime = runtime_semantic_diff()
    dens = denominator_adequacy_audit()
    tl = timeline()
    decision = validity_decision(reuse=reuse, gates=gates, runtime=runtime, dens=dens)
    protocol = r3n2_protocol_spec()
    sidecar = invalidation_sidecar(decision)

    # Template family audit (separate artifact)
    fam_audit = {
        "schema_version": "mai07_r3n_template_family_overlap_audit_v1",
        "overlap_count": reuse["template_family_overlap_count"],
        "overlap_families": reuse["template_family_overlap"],
        "full_overlap": reuse["template_family_overlap_count"] == 8,
        "same_seed_family": reuse["same_builder_seed_family"],
    }

    scorer_pop_diff = {
        "schema_version": "mai07_r3n_scorer_and_population_diff_v1",
        "scorer_version_string_rc001_and_rc002": "mai-07-r3n.scorer.1.0.0",
        "scorer_source_changed_after_attempt001": True,
        "population_requiredness_changed_after_attempt001": True,
        "threshold_json_hash_stable": gates["threshold_hash_unchanged_vs_expected"],
        "authorized_code_corrective": gates["authorized_code_corrective"],
        "current_source_hashes": gates["current_scorer_source_hashes"],
    }

    rc_diff = {
        "schema_version": "mai07_r3n_rc001_rc002_diff_v1",
        "rc001_lock_semantic": tl["events"][0]["bound_lock_semantic_sha256"],
        "rc002_lock_semantic": tl["events"][4]["bound_lock_semantic_sha256"],
        "same_candidate_runtime_version": runtime["candidate_version_reused"],
        "same_pack_hash": runtime["pack_hash_reused"],
        "holdout_sha_rc001": reuse["attempt001_holdout_raw_sha256_claimed_in_rc001_lock"],
        "holdout_sha_rc002": reuse["attempt002_holdout_raw_sha256_claimed_in_rc002_lock"],
        "exact_case_reuse_count": reuse["exact_case_reuse_count"],
        "exact_text_reuse_count": reuse["exact_text_reuse_count"],
        "template_family_overlap_count": reuse["template_family_overlap_count"],
    }

    imm = {
        "schema_version": "mai07_r3n_integrity_immutability_v1",
        "active_runtime": RUNTIME_VERSION,
        "active_ok": RUNTIME_VERSION == PARENT_RUNTIME_VERSION,
        "overlay_disabled": ENABLE_PROMOTION_OVERLAY is False,
        "parent_resource_hash": PARENT_RESOURCE_HASH,
        "no_prediction_rerun": True,
        "attempt_bodies_unchanged_by_this_phase": True,
        "lock_bodies_unchanged_by_this_phase": True,
        "candidate_promoted": False,
    }

    artifacts: dict[str, str] = {}
    if write:
        payloads = {
            "FORENSIC_SNAPSHOT.manifest.json": snap,
            "ATTEMPT_TIMELINE.json": tl,
            "RC_001_RC_002_DIFF.json": rc_diff,
            "HOLDOUT_REUSE_AUDIT.json": reuse,
            "TEMPLATE_FAMILY_OVERLAP_AUDIT.json": fam_audit,
            "RUNTIME_SEMANTIC_DIFF.json": runtime,
            "SCORER_AND_POPULATION_DIFF.json": scorer_pop_diff,
            "GATE_SEMANTICS_AUDIT.json": gates,
            "DENOMINATOR_ADEQUACY_AUDIT.json": dens,
            "RC_002_VALIDITY_DECISION.json": decision,
            "HISTORICAL_INVALIDATION_SIDECAR.json": sidecar,
            "R3N2_FRESH_HOLDOUT_PROTOCOL.json": protocol,
            "IMMUTABILITY_REPORT.json": imm,
        }
        for name, obj in payloads.items():
            artifacts[name] = _write_json(CLOSURE_OUT / name, obj)

        # Also place sidecar next to RC_002 as append-only companion (does not mutate lock).
        artifacts["sidecar_beside_rc002"] = _write_json(
            R3N_OUT / f"{RC002}.HISTORICAL_INVALIDATION_SIDECAR.json",
            sidecar,
        )

        semantic_body = {
            "schema_version": "mai07_r3n_integrity_closure_semantic_v1",
            "phase": "MAI-07R3N-INTEGRITY-CLOSURE",
            "primary_verdict": decision["primary_verdict"],
            "secondary_reasons": decision["secondary_reasons"],
            "artifact_raw_sha256": artifacts,
            "r3m_closure_preserved": "f39432c6e085c89964e2551fe27921d32c79235061fea218262f6d3093e00afd",
            "prohibited_for_training": True,
            "MAI-08": "NOT_STARTED",
        }
        semantic_body["semantic_sha256"] = semantic_json_hash(
            {k: v for k, v in semantic_body.items() if k != "semantic_sha256"}
        )
        artifacts["SEMANTIC_HASH.json"] = _write_json(CLOSURE_OUT / "SEMANTIC_HASH.json", semantic_body)
    else:
        semantic_body = {
            "primary_verdict": decision["primary_verdict"],
            "secondary_reasons": decision["secondary_reasons"],
        }

    return {
        "verdict": decision["primary_verdict"],
        "secondary_reasons": decision["secondary_reasons"],
        "decision": decision,
        "artifacts": artifacts,
        "semantic": semantic_body,
        "immutability": imm,
    }


def main() -> int:
    import argparse

    p = argparse.ArgumentParser(description="MAI-07R3N integrity closure (read-only forensics)")
    p.add_argument("--write", action="store_true")
    p.add_argument("--check", action="store_true", help="Run audits without writing")
    args = p.parse_args()
    write = bool(args.write)
    result = run_closure(write=write)
    print(
        json.dumps(
            {
                "verdict": result["verdict"],
                "secondary_reasons": result["secondary_reasons"],
                "next": result["decision"]["next_governed_phase"],
                "wrote": write,
                "artifact_count": len(result.get("artifacts") or {}),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
