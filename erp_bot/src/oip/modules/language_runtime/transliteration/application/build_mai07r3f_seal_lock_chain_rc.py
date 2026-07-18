"""MAI-07R3F-SEAL-LOCK-CHAIN — append-only LOCKED_NOT_RUN RC (Branch B)."""

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
    PARENT_PRE_R1_RESOURCE_HASH,
    PARENT_PRE_R1_RUNTIME_VERSION,
    PARENT_R3D_RC_HASH,
    PARENT_R3D_RESOURCE_HASH,
    PARENT_R3D_RUNTIME_VERSION,
    PARENT_R3E_ATTEMPT_HASH,
    PARENT_R3F_INVALIDATED_RC_HASH,
    PARENT_R3F_INVALIDATED_RESOURCE_CLAIM,
    PARENT_R3F_INVALIDATED_RUNTIME_VERSION,
    PARENT_R3F_INVALIDATED_STATUS,
    RESOURCE_PACK_VERSION,
    RUNTIME_VERSION,
)
from ..infrastructure.english_identity_guard import EVAL_VERSION, GUARD_VERSION
from .rc_lock_chain import (
    build_locked_rc,
    compute_rc_semantic_body_sha256,
    create_lock_record,
)
from ..infrastructure.resource_repository import (
    HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR,
    RESOURCES_DIR,
    compute_pack_content_hash,
    load_resources,
)
from ..infrastructure.seal_contract_v2 import (
    SEAL_CONTRACT_VERSION,
    build_resource_seal_fields,
    contract_metadata,
    runtime_source_sha256,
    sha256_file,
)

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3f_seal_lock_chain"
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
RC_ID = "MAI_07R3F_LOCK_CHAIN_RELEASE_CANDIDATE_002"
LOCK_PATH = OUT / f"{RC_ID}.LOCKED_NOT_RUN.json"
LOCK_RECORD_PATH = OUT / f"{RC_ID}.LOCK_RECORD.json"
PARENT_SEAL_NEW_RC_SEMANTIC = "530192228e7827bc33213f7ad8a3f4c2b75bdba6a01d78611617fd2d27c10e5c"
MISSING_LOCK_SEMANTIC = "f4c07e24cb78550496720881fbc2b6019650006f8bd39eedd716fd046b6107ff"


def code_semantic_hash() -> str:
    files = [
        XL / "application/transliteration_service.py",
        XL / "infrastructure/deterministic_ranker.py",
        XL / "infrastructure/deterministic_generator.py",
        XL / "infrastructure/r3d_safety_gate.py",
        XL / "infrastructure/english_identity_guard.py",
        XL / "__init__.py",
        RESOURCES_DIR / "r3f_english_identity_guard.json",
    ]
    return runtime_source_sha256(files)


def build_lock_body(*, repo: Path = REPO, lock_timestamp: str | None = None) -> dict[str, Any]:
    load_resources(force_reload=True)
    if ENABLE_PROMOTION_OVERLAY:
        raise RuntimeError("overlay must be disabled for lock-chain RC")
    if RUNTIME_VERSION != "mai-07.1.3-r3f-sealnew":
        raise RuntimeError(f"unexpected runtime {RUNTIME_VERSION}")
    ds = json.loads((OUT / "MAI_07R3F_SEAL_LOCK_CHAIN_DATASET_MANIFEST.json").read_text(encoding="utf-8"))
    if not ds.get("locked_before_runtime_correction"):
        raise RuntimeError("datasets must be locked before RC")
    thr_path = OUT / "MAI_07R3F_SEAL_LOCK_CHAIN_HOLDOUT_THRESHOLDS.json"
    thr = thr_path.read_bytes()
    man = json.loads((RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8"))
    res_hash = compute_pack_content_hash()
    if res_hash != man.get("content_hash"):
        raise RuntimeError("active pack claim/compute mismatch")
    seal_v2 = build_resource_seal_fields(resources_dir=RESOURCES_DIR, manifest=man)
    guard_path = RESOURCES_DIR / "r3f_english_identity_guard.json"
    guard_hash = sha256_file(guard_path)
    semantic = code_semantic_hash()
    hist_claim = json.loads(
        (HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8")
    ).get("content_hash")
    if hist_claim != PARENT_R3F_INVALIDATED_RESOURCE_CLAIM:
        raise RuntimeError("historical claim drift")
    ts = lock_timestamp or datetime.now(timezone.utc).isoformat()
    holdout_cmd = (
        "python -m src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3f_seal_lock_chain "
        "--split HOLDOUT_VALIDATION --one-shot"
    )
    return {
        "schema_version": "2.0.0",
        "manifest_id": RC_ID,
        "lock_chain_phase": "MAI-07R3F-SEAL-LOCK-CHAIN",
        "branch": "B_APPEND_ONLY_NEW_RC",
        "locked": True,
        "locked_before_holdout": True,
        "lock_timestamp": ts,
        "prohibited_rerun": True,
        "deterministic_seed": 20260718,
        "environment_fingerprint": {
            "python": sys.version.split()[0],
            "platform": platform.platform(),
            "machine": platform.machine(),
        },
        "runtime_version": RUNTIME_VERSION,
        "resource_pack_version": RESOURCE_PACK_VERSION,
        "resource_content_sha256": res_hash,
        "resource_pack_path": str(RESOURCES_DIR.relative_to(repo)).replace("\\", "/"),
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "seal_contract_hash": sha256_file(XL / "infrastructure/seal_contract_v2.py"),
        "seal_v2": seal_v2,
        "english_identity_guard_version": ENGLISH_IDENTITY_GUARD_VERSION,
        "guard_config_sha256": guard_hash,
        "guard_version": GUARD_VERSION,
        "evaluator_version": EVAL_VERSION,
        "runtime_source_sha256": semantic,
        "runtime_config_sha256": guard_hash,
        "runtime_semantic_sha256": semantic,
        "canonical_scorer": "mai-07.r3f.seal-lock-chain.canonical.1.0.0",
        "audit_scorer": "mai-07.r3f.seal-lock-chain.audit.1.0.0",
        "parent_pre_r1_runtime_version": PARENT_PRE_R1_RUNTIME_VERSION,
        "parent_pre_r1_resource_hash": PARENT_PRE_R1_RESOURCE_HASH,
        "parent_r3d_runtime_version": PARENT_R3D_RUNTIME_VERSION,
        "parent_r3d_resource_hash": PARENT_R3D_RESOURCE_HASH,
        "parent_r3d_rc_hash": PARENT_R3D_RC_HASH,
        "parent_r3e_failed_attempt_hash": PARENT_R3E_ATTEMPT_HASH,
        "parent_rc_id": "MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001",
        "parent_rc_status": "PASSED_NEW_RC_INCOMPLETE_LOCK_CHAIN",
        "parent_rc_manifest_sha256": PARENT_SEAL_NEW_RC_SEMANTIC,
        "parent_rc_runtime_version": RUNTIME_VERSION,
        "parent_rc_resource_claim": res_hash,
        "parent_missing_lock_semantic_sha256": MISSING_LOCK_SEMANTIC,
        "parent_frozen_v1_hash": "5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208",
        "parent_frozen_v2_hash": "0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9",
        "fresh_development_dataset_sha256": ds["splits"]["DEVELOPMENT"]["sha256"],
        "fresh_holdout_dataset_sha256": ds["splits"]["HOLDOUT_VALIDATION"]["sha256"],
        "fresh_safety_dataset_sha256": ds["splits"]["SAFETY_CHALLENGE"]["sha256"],
        "fresh_counterfactual_dataset_sha256": ds["splits"]["CONTEXT_COUNTERFACTUAL"]["sha256"],
        "dataset_manifest_sha256": sha256_file(OUT / "MAI_07R3F_SEAL_LOCK_CHAIN_DATASET_MANIFEST.json"),
        "threshold_sha256": hashlib.sha256(thr).hexdigest(),
        "no_runtime_tuning": True,
        "no_frozen_data_use": True,
        "no_old_holdout_reuse": True,
        "no_seal_new_holdout_reuse": True,
        "exact_fresh_holdout_command": holdout_cmd,
        "ENABLE_PROMOTION_OVERLAY": False,
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "QUALITY_GATES_PASSED": False,
        "AUTOMATED_ENGINEERING_GATES_PASSED": False,
        "note": (
            "Append-only LOCKED_NOT_RUN body for MAI-07R3F-SEAL-LOCK-CHAIN Branch B. "
            "Parent SEAL-NEW RC lacked immutable pre-holdout lock artifact for f4c07e24…. "
            "Frozen V2 reserved for MAI-07R3G-REAUTHORIZED-002."
        ),
        "test_manifest": [
            "erp_bot/tests/oip/language_runtime/test_mai07_r3f_seal_lock_chain.py",
            "erp_bot/tests/oip/language_runtime/test_mai07_r3f_firewall.py",
            "erp_bot/tests/oip/language_runtime/test_mai07_r3f_english_identity.py",
            "erp_bot/tests/oip/language_runtime/test_mai07_seal_contract_v2.py",
        ],
        "contract_metadata": contract_metadata(),
        "manifest_path": str(LOCK_PATH.relative_to(repo)).replace("\\", "/"),
    }


def persist_locked_rc(*, repo: Path = REPO, lock_timestamp: str | None = None) -> dict[str, Any]:
    body = build_lock_body(repo=repo, lock_timestamp=lock_timestamp)
    result = build_locked_rc(body, output_path=LOCK_PATH, dual_build_check=True)
    locked = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    sem = compute_rc_semantic_body_sha256(locked)
    record = create_lock_record(
        rc_id=RC_ID,
        locked_path=LOCK_PATH,
        locked_body=locked,
        parent_lock_semantic=MISSING_LOCK_SEMANTIC,
        provenance="APPEND_ONLY_LOCK_CHAIN_BRANCH_B",
    )
    if LOCK_RECORD_PATH.exists():
        raise FileExistsError(f"lock record already exists: {LOCK_RECORD_PATH}")
    LOCK_RECORD_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOCK_RECORD_PATH.write_text(
        json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return {
        **result,
        "rc_manifest_semantic_sha256": sem,
        "lock_record_path": str(LOCK_RECORD_PATH.relative_to(repo)).replace("\\", "/"),
    }


def main() -> int:
    print(json.dumps(persist_locked_rc(), ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
