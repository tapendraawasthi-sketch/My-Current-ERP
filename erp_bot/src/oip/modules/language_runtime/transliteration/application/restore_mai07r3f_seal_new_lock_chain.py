"""Restore SEAL-NEW RC_001 post-holdout manifest and extract immutable lock body (Branch A)."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from .rc_lock_chain import (
    build_locked_rc,
    compute_rc_semantic_body_sha256,
    create_lock_record,
    verify_complete_chain,
    verify_locked_rc,
)
from ..infrastructure.seal_contract_v2 import (
    predictions_canonical_list_sha256,
    predictions_jsonl_raw_sha256,
    sha256_file,
)

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3f_seal_new"
RC_ID = "MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001"
LOCK_PATH = OUT / f"{RC_ID}.LOCKED_NOT_RUN.json"
MANIFEST_PATH = OUT / f"{RC_ID}.manifest.json"
LOCK_RECORD_PATH = OUT / f"{RC_ID}.LOCK_RECORD.json"
CHAIN_PATH = OUT / f"{RC_ID}.CHAIN_MANIFEST.json"
QUAL_PATH = OUT / f"{RC_ID}.QUALIFICATION_RESULT.json"
ATTEMPT_PATH = OUT / "reports/MAI_07R3F_SEAL_NEW_HOLDOUT_ATTEMPT.json"
SCORE_PATH = OUT / "reports/MAI_07R3F_SEAL_NEW_HOLDOUT_VALIDATION_SCORE_REPORT.json"

EXPECTED_LOCK_SEM = "f4c07e24cb78550496720881fbc2b6019650006f8bd39eedd716fd046b6107ff"
EXPECTED_POST_SEM = "530192228e7827bc33213f7ad8a3f4c2b75bdba6a01d78611617fd2d27c10e5c"
PRED_RAW = "0f1c72f8ee38e457c7d132dc03553f4299d59f80fa956752e97660cab9a7c09c"
PRED_CANON = "ba64b365718018c213c0a6955bcfb4c8b8f9c6f465e328113e662e161d26f2c4"


def _rc_semantic(obj: dict) -> str:
    core = {
        k: v
        for k, v in obj.items()
        if k not in {"manifest_sha256", "rc_manifest_raw_sha256", "rc_manifest_semantic_sha256"}
    }
    return hashlib.sha256(
        (json.dumps(core, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    ).hexdigest()


def extract_immutable_lock(*, repo: Path = REPO) -> dict:
    from .build_mai07r3f_seal_new_rc import build_rc

    if LOCK_PATH.exists():
        lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    else:
        lock = build_rc(repo=repo, lock_timestamp="2026-07-16T00:00:00+00:00", write=False)
        build_locked_rc(lock, output_path=LOCK_PATH, dual_build_check=True)
        lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    v = verify_locked_rc(lock, expected_semantic=EXPECTED_LOCK_SEM)
    if not v["ok"]:
        raise RuntimeError(f"lock body invalid: {v['errors']}")
    if not LOCK_RECORD_PATH.exists():
        record = create_lock_record(
            rc_id=RC_ID,
            locked_path=LOCK_PATH,
            locked_body=lock,
            provenance="RECONSTRUCTED_FROM_PREEXISTING_HASH_COMMITMENT",
        )
        record["reconstruction_utc"] = datetime.now(timezone.utc).isoformat()
        record["prior_commitments"] = [
            f"{ATTEMPT_PATH.name}:rc_manifest_sha256_locked_before_holdout",
            f"{SCORE_PATH.name}:rc_manifest_sha256_locked_before_holdout",
        ]
        LOCK_RECORD_PATH.write_text(
            json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
    return {"lock_semantic_sha256": compute_rc_semantic_body_sha256(lock), "path": str(LOCK_PATH)}


def restore_post_holdout_manifest(*, repo: Path = REPO) -> dict:
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    attempt_raw = json.loads(ATTEMPT_PATH.read_text(encoding="utf-8"))
    score = json.loads(SCORE_PATH.read_text(encoding="utf-8"))
    attempt_fields = {
        "attempt_id",
        "split",
        "start_time",
        "end_time",
        "elapsed_seconds",
        "submitted_count",
        "completed_count",
        "exceptions",
        "timeouts",
        "runtime_version",
        "resource_pack_version",
        "resource_content_sha256",
        "predictions_jsonl_raw_sha256",
        "predictions_canonical_list_sha256",
        "predictions_semantic_sha256",
        "prediction_path",
        "mutation_attempts",
        "successful_mutations",
        "gate_all_pass",
        "prohibited_rerun",
        "frozen_v2_opened",
    }
    attempt = {k: attempt_raw[k] for k in attempt_fields if k in attempt_raw}
    post = dict(lock)
    post["status"] = "PASSED_NEW_RC"
    post["AUTOMATED_ENGINEERING_GATES_PASSED"] = True
    post["holdout_gate_all_pass"] = attempt["gate_all_pass"]
    post["holdout_attempt"] = attempt
    sem = _rc_semantic(post)
    if sem != EXPECTED_POST_SEM:
        raise RuntimeError(f"post-holdout semantic drift: {sem} != {EXPECTED_POST_SEM}")
    post["rc_manifest_semantic_sha256"] = sem
    post["manifest_sha256"] = sem
    core_with_sem = {k: v for k, v in post.items() if k != "rc_manifest_raw_sha256"}
    post["rc_manifest_raw_sha256"] = hashlib.sha256(
        (json.dumps(core_with_sem, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    ).hexdigest()
    MANIFEST_PATH.write_text(
        json.dumps(post, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return {
        "manifest_sha256": sem,
        "canonical_report_semantic_sha256": score.get("canonical_report_semantic_sha256"),
        "audit_report_semantic_sha256": score.get("audit_report_semantic_sha256"),
    }


def bind_saved_holdout_chain(*, repo: Path = REPO) -> dict:
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    attempt = json.loads(ATTEMPT_PATH.read_text(encoding="utf-8"))
    score = json.loads(SCORE_PATH.read_text(encoding="utf-8"))
    pred_path = repo / attempt["prediction_path"]
    preds = [json.loads(ln) for ln in pred_path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    raw = predictions_jsonl_raw_sha256(pred_path)
    canon = predictions_canonical_list_sha256(preds)
    if raw != PRED_RAW or canon != PRED_CANON:
        raise RuntimeError("saved prediction hash mismatch")
    qual = {
        "schema_version": "2.0.0",
        "record_type": "QUALIFICATION_RESULT",
        "rc_id": RC_ID,
        "parent_lock_semantic_sha256": EXPECTED_LOCK_SEM,
        "attempt_id": attempt["attempt_id"],
        "status": "PASSED_HOLDOUT",
        "gate_all_pass": True,
        "metrics_summary": {"all_pass": True, "metrics": score["report"]["metrics"]},
        "QUALITY_GATES_PASSED": False,
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "predictions_jsonl_raw_sha256": raw,
        "predictions_canonical_list_sha256": canon,
        "canonical_report_semantic_sha256": score.get("canonical_report_semantic_sha256"),
        "audit_report_semantic_sha256": score.get("audit_report_semantic_sha256"),
        "provenance": "SAVED_HOLDOUT_EVIDENCE_ONLY_NO_RERUN",
        "created_utc": datetime.now(timezone.utc).isoformat(),
    }
    if not QUAL_PATH.exists():
        QUAL_PATH.write_text(
            json.dumps(qual, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
    chain = {
        "schema_version": "2.0.0",
        "record_type": "CHAIN_MANIFEST",
        "rc_id": RC_ID,
        "phase": "MAI-07R3F-SEAL-LOCK-CHAIN",
        "branch": "A_RECOVERED_LOCK_CHAIN",
        "verdict": "PASSED_RECOVERED_LOCK_CHAIN",
        "locked_not_run_path": str(LOCK_PATH.relative_to(repo)).replace("\\", "/"),
        "lock_record_path": str(LOCK_RECORD_PATH.relative_to(repo)).replace("\\", "/"),
        "holdout_attempt_path": str(ATTEMPT_PATH.relative_to(repo)).replace("\\", "/"),
        "qualification_path": str(QUAL_PATH.relative_to(repo)).replace("\\", "/"),
        "post_holdout_manifest_path": str(MANIFEST_PATH.relative_to(repo)).replace("\\", "/"),
        "locked_semantic_sha256": EXPECTED_LOCK_SEM,
        "locked_raw_sha256": sha256_file(LOCK_PATH),
        "post_holdout_semantic_sha256": EXPECTED_POST_SEM,
        "predictions_jsonl_raw_sha256": raw,
        "predictions_canonical_list_sha256": canon,
        "canonical_report_semantic_sha256": score.get("canonical_report_semantic_sha256"),
        "audit_report_semantic_sha256": score.get("audit_report_semantic_sha256"),
        "scorer_agreement": score["audit"]["metrics"] == score["report"]["metrics"],
        "frozen_v2_opened": False,
        "holdout_rerun": False,
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "QUALITY_GATES_PASSED": False,
        "created_utc": datetime.now(timezone.utc).isoformat(),
    }
    CHAIN_PATH.write_text(
        json.dumps(chain, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    v = verify_complete_chain(chain, repo)
    if not v["ok"]:
        raise RuntimeError(f"chain verification failed: {v['errors']}")
    return chain


def main() -> int:
    extract_immutable_lock()
    restore_post_holdout_manifest()
    chain = bind_saved_holdout_chain()
    print(json.dumps(chain, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
