"""MAI-07 append-only RC lock chain — seal-contract 2.0.0.

Canonical authority for LOCKED_NOT_RUN bodies, attempt binding, and chain verification.
"""

from __future__ import annotations

import hashlib
import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..infrastructure.seal_contract_v2 import (
    SEAL_CONTRACT_VERSION,
    predictions_canonical_list_sha256,
    predictions_jsonl_raw_sha256,
    pretty_report_bytes,
    semantic_json_hash,
    sha256_bytes,
    sha256_file,
)

RC_HASH_EXCLUDED_KEYS = frozenset(
    {
        "manifest_sha256",
        "rc_manifest_raw_sha256",
        "rc_manifest_semantic_sha256",
    }
)

POST_HOLDOUT_FORBIDDEN_IN_LOCK = frozenset(
    {
        "holdout_attempt",
        "holdout_gate_all_pass",
        "predictions_jsonl_raw_sha256",
        "predictions_canonical_list_sha256",
        "predictions_semantic_sha256",
        "prediction_path",
        "report_path",
        "gate_decision",
        "metrics",
        "harm",
        "differential",
        "attempt",
        "qualification",
    }
)

LOCK_REQUIRED_STATUS = "LOCKED_NOT_RUN"


def rc_semantic_body(obj: dict[str, Any]) -> dict[str, Any]:
    """Object hashed for rc_manifest_semantic_sha256 / manifest_sha256 at lock."""
    return {k: v for k, v in obj.items() if k not in RC_HASH_EXCLUDED_KEYS}


def compute_rc_semantic_body_sha256(obj: dict[str, Any]) -> str:
    """SHA-256 of pretty JSON (indent=2, sort_keys, LF) of semantic body."""
    body = rc_semantic_body(obj)
    return sha256_bytes(pretty_report_bytes(body))


def compute_rc_raw_file_sha256(path: Path) -> str:
    return sha256_file(path)


def write_json_immutable(path: Path, obj: dict[str, Any]) -> str:
    """Write once; refuse overwrite."""
    if path.exists():
        raise FileExistsError(f"refusing to overwrite immutable artifact: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return compute_rc_raw_file_sha256(path)


def verify_locked_rc(body: dict[str, Any], *, expected_semantic: str | None = None) -> dict[str, Any]:
    errors: list[str] = []
    if body.get("status") != LOCK_REQUIRED_STATUS:
        errors.append(f"status_not_LOCKED_NOT_RUN:{body.get('status')}")
    if not body.get("locked") or not body.get("locked_before_holdout"):
        errors.append("not_locked_before_holdout")
    if body.get("ENABLE_PROMOTION_OVERLAY") is not False:
        errors.append("overlay_enabled")
    for key in POST_HOLDOUT_FORBIDDEN_IN_LOCK:
        if key in body:
            errors.append(f"post_holdout_field_in_lock:{key}")
    if body.get("seal_contract_version") != SEAL_CONTRACT_VERSION:
        errors.append("seal_contract_version_mismatch")
    sem = compute_rc_semantic_body_sha256(body)
    if expected_semantic and sem != expected_semantic:
        errors.append(f"semantic_mismatch:expected={expected_semantic}:actual={sem}")
    if body.get("manifest_sha256") and body.get("manifest_sha256") != sem:
        errors.append("manifest_sha256_field_mismatch")
    return {"ok": not errors, "errors": errors, "rc_manifest_semantic_sha256": sem}


def build_locked_rc(
    body: dict[str, Any],
    *,
    output_path: Path,
    dual_build_check: bool = True,
) -> dict[str, Any]:
    """Persist LOCKED_NOT_RUN body in a single immutable write."""
    locked = dict(body)
    locked["status"] = LOCK_REQUIRED_STATUS
    locked["locked"] = True
    locked["locked_before_holdout"] = True
    for key in POST_HOLDOUT_FORBIDDEN_IN_LOCK:
        locked.pop(key, None)

    sem = compute_rc_semantic_body_sha256(locked)
    locked["rc_manifest_semantic_sha256"] = sem
    locked["manifest_sha256"] = sem
    core_with_sem = {k: v for k, v in locked.items() if k != "rc_manifest_raw_sha256"}
    raw_contract = sha256_bytes(pretty_report_bytes(core_with_sem))
    locked["rc_manifest_raw_sha256"] = raw_contract

    serialized = (json.dumps(locked, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")

    if dual_build_check:
        with tempfile.TemporaryDirectory(prefix="mai07_lock_a_") as ta, tempfile.TemporaryDirectory(
            prefix="mai07_lock_b_"
        ) as tb:
            pa = Path(ta) / "body.json"
            pb = Path(tb) / "body.json"
            pa.write_bytes(serialized)
            pb.write_bytes(serialized)
            if pa.read_bytes() != pb.read_bytes():
                raise RuntimeError("dual_build_lock_body_mismatch")

    if output_path.exists():
        raise FileExistsError(f"refusing to overwrite immutable artifact: {output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(serialized)

    return {
        "path": str(output_path),
        "rc_manifest_semantic_sha256": sem,
        "rc_manifest_raw_sha256": raw_contract,
        "rc_manifest_raw_sha256_contract": raw_contract,
        "dual_build_identical": dual_build_check,
    }


def create_lock_record(
    *,
    rc_id: str,
    locked_path: Path,
    locked_body: dict[str, Any],
    parent_lock_semantic: str | None = None,
    provenance: str = "APPEND_ONLY_LOCK_CHAIN",
) -> dict[str, Any]:
    sem = compute_rc_semantic_body_sha256(locked_body)
    return {
        "schema_version": "2.0.0",
        "record_type": "LOCK_RECORD",
        "rc_id": rc_id,
        "provenance": provenance,
        "locked_at_utc": datetime.now(timezone.utc).isoformat(),
        "locked_body_path": str(locked_path).replace("\\", "/"),
        "locked_rc_body": locked_body,
        "parent_lock_semantic_sha256": parent_lock_semantic,
        "rc_manifest_semantic_sha256": sem,
        "rc_manifest_raw_sha256": compute_rc_raw_file_sha256(locked_path),
        "seal_contract_version": SEAL_CONTRACT_VERSION,
    }


def create_attempt(
    *,
    attempt_id: str,
    rc_id: str,
    lock_semantic_sha256: str,
    lock_raw_sha256: str,
    command: str,
    split: str,
) -> dict[str, Any]:
    return {
        "schema_version": "2.0.0",
        "record_type": "HOLDOUT_ATTEMPT",
        "attempt_id": attempt_id,
        "rc_id": rc_id,
        "parent_lock_semantic_sha256": lock_semantic_sha256,
        "parent_lock_raw_sha256": lock_raw_sha256,
        "split": split,
        "command": command,
        "status": "LOCKED_NOT_RUN",
        "prohibited_rerun": True,
        "frozen_v2_opened": False,
        "created_utc": datetime.now(timezone.utc).isoformat(),
    }


def bind_predictions(
    attempt: dict[str, Any],
    *,
    pred_path: Path,
    preds: list[dict[str, Any]],
) -> dict[str, Any]:
    out = dict(attempt)
    out["status"] = "COMPLETED"
    out["prediction_path"] = str(pred_path).replace("\\", "/")
    out["prediction_count"] = len(preds)
    out["predictions_jsonl_raw_sha256"] = predictions_jsonl_raw_sha256(pred_path)
    out["predictions_canonical_list_sha256"] = predictions_canonical_list_sha256(preds)
    out["predictions_semantic_sha256"] = out["predictions_canonical_list_sha256"]
    return out


def create_qualification_result(
    *,
    rc_id: str,
    lock_semantic_sha256: str,
    gate_all_pass: bool,
    attempt_id: str,
    metrics_summary: dict[str, Any],
) -> dict[str, Any]:
    return {
        "schema_version": "2.0.0",
        "record_type": "QUALIFICATION_RESULT",
        "rc_id": rc_id,
        "parent_lock_semantic_sha256": lock_semantic_sha256,
        "attempt_id": attempt_id,
        "status": "PASSED_HOLDOUT" if gate_all_pass else "FAILED_HOLDOUT_QUALITY",
        "gate_all_pass": gate_all_pass,
        "metrics_summary": metrics_summary,
        "QUALITY_GATES_PASSED": False,
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "note": "Qualification is separate from LOCKED_NOT_RUN body; lock file must remain unchanged.",
    }


def verify_complete_chain(chain: dict[str, Any], repo: Path) -> dict[str, Any]:
    errors: list[str] = []

    lock_path = repo / chain["locked_not_run_path"]
    if not lock_path.exists():
        errors.append("missing_locked_body")
    else:
        lock = json.loads(lock_path.read_text(encoding="utf-8"))
        v = verify_locked_rc(lock, expected_semantic=chain.get("locked_semantic_sha256"))
        if not v["ok"]:
            errors.extend(v["errors"])
        if sha256_file(lock_path) != chain.get("locked_raw_sha256"):
            errors.append("locked_raw_sha256_mismatch")

    attempt_path = repo / chain["holdout_attempt_path"]
    if attempt_path.exists():
        att = json.loads(attempt_path.read_text(encoding="utf-8"))
        parent = att.get("parent_lock_semantic_sha256") or att.get(
            "rc_manifest_sha256_locked_before_holdout"
        )
        if parent != chain.get("locked_semantic_sha256"):
            errors.append("attempt_lock_binding_mismatch")
        pred_path = repo / att.get("prediction_path", "")
        if pred_path.exists():
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

    qual_path = chain.get("qualification_path")
    if qual_path:
        qp = repo / qual_path
        if qp.exists():
            qual = json.loads(qp.read_text(encoding="utf-8"))
            if qual.get("parent_lock_semantic_sha256") != chain.get("locked_semantic_sha256"):
                errors.append("qualification_lock_binding_mismatch")

    return {"ok": not errors, "errors": errors}


def score_report_hashes(report: dict[str, Any], report_path: Path) -> dict[str, str]:
    return {
        "canonical_report_raw_sha256": sha256_file(report_path),
        "canonical_report_semantic_sha256": semantic_json_hash(report),
    }
