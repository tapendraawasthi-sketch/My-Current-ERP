"""MAI-07R3F-SEAL-NEW release-candidate lock. Must precede one-shot fresh holdout."""

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
OUT = REPO / "evals" / "mai07_r3f_seal_new"
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
RC_ID = "MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001"


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


def build_rc(*, repo: Path = REPO, lock_timestamp: str | None = None, write: bool = True) -> dict[str, Any]:
    load_resources(force_reload=True)
    if ENABLE_PROMOTION_OVERLAY:
        raise RuntimeError("overlay must be disabled for SEAL-NEW RC")
    if RUNTIME_VERSION != "mai-07.1.3-r3f-sealnew":
        raise RuntimeError(f"unexpected runtime {RUNTIME_VERSION}")
    if RESOURCE_PACK_VERSION != "mai-07.1.3-r3f-sealnew":
        raise RuntimeError(f"unexpected pack {RESOURCE_PACK_VERSION}")
    ds = json.loads((OUT / "MAI_07R3F_SEAL_NEW_DATASET_MANIFEST.json").read_text(encoding="utf-8"))
    if not ds.get("locked_before_runtime_correction"):
        raise RuntimeError("datasets must be locked before RC")
    thr_path = OUT / "MAI_07R3F_SEAL_NEW_HOLDOUT_THRESHOLDS.json"
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
        "python -m src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3f_seal_new "
        "--split HOLDOUT_VALIDATION --one-shot"
    )
    rc: dict[str, Any] = {
        "schema_version": "2.0.0",
        "manifest_id": RC_ID,
        "status": "LOCKED_NOT_RUN",
        "locked": True,
        "locked_before_holdout": True,
        "lock_timestamp": ts,
        "prohibited_rerun": True,
        "deterministic_seed": 20260717,
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
        "seal_contract_hash": sha256_file(
            XL / "infrastructure/seal_contract_v2.py"
        ),
        "seal_v2": seal_v2,
        "english_identity_guard_version": ENGLISH_IDENTITY_GUARD_VERSION,
        "guard_config_sha256": guard_hash,
        "guard_version": GUARD_VERSION,
        "evaluator_version": EVAL_VERSION,
        "runtime_source_sha256": semantic,
        "runtime_config_sha256": guard_hash,
        "runtime_semantic_sha256": semantic,
        "canonical_scorer": "mai-07.r3f.sealnew.canonical.1.0.0",
        "audit_scorer": "mai-07.r3f.sealnew.audit.1.0.0",
        "parent_pre_r1_runtime_version": PARENT_PRE_R1_RUNTIME_VERSION,
        "parent_pre_r1_resource_hash": PARENT_PRE_R1_RESOURCE_HASH,
        "parent_r3d_runtime_version": PARENT_R3D_RUNTIME_VERSION,
        "parent_r3d_resource_hash": PARENT_R3D_RESOURCE_HASH,
        "parent_r3d_rc_hash": PARENT_R3D_RC_HASH,
        "parent_r3e_failed_attempt_hash": PARENT_R3E_ATTEMPT_HASH,
        "parent_rc_id": "MAI_07R3F_RELEASE_CANDIDATE",
        "parent_rc_status": PARENT_R3F_INVALIDATED_STATUS,
        "parent_rc_manifest_sha256": PARENT_R3F_INVALIDATED_RC_HASH,
        "parent_rc_runtime_version": PARENT_R3F_INVALIDATED_RUNTIME_VERSION,
        "parent_rc_resource_claim": PARENT_R3F_INVALIDATED_RESOURCE_CLAIM,
        "parent_frozen_v1_hash": "5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208",
        "parent_frozen_v2_hash": "0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9",
        "fresh_development_dataset_sha256": ds["splits"]["DEVELOPMENT"]["sha256"],
        "fresh_holdout_dataset_sha256": ds["splits"]["HOLDOUT_VALIDATION"]["sha256"],
        "fresh_safety_dataset_sha256": ds["splits"]["SAFETY_CHALLENGE"]["sha256"],
        "fresh_counterfactual_dataset_sha256": ds["splits"]["CONTEXT_COUNTERFACTUAL"]["sha256"],
        "dataset_manifest_sha256": sha256_file(OUT / "MAI_07R3F_SEAL_NEW_DATASET_MANIFEST.json"),
        "threshold_sha256": hashlib.sha256(thr).hexdigest(),
        "no_runtime_tuning": True,
        "no_frozen_data_use": True,
        "no_old_holdout_reuse": True,
        "exact_fresh_holdout_command": holdout_cmd,
        "ENABLE_PROMOTION_OVERLAY": False,
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "QUALITY_GATES_PASSED": False,
        "AUTOMATED_ENGINEERING_GATES_PASSED": False,
        "note": (
            "New versioned RC under seal-contract 2.0.0. "
            "Fresh holdout only. Parent R3F RC INVALIDATED_BY_SEAL_DRIFT. "
            "Frozen V2 reserved for MAI-07R3G-REAUTHORIZED."
        ),
        "test_manifest": [
            "erp_bot/tests/oip/language_runtime/test_mai07_r3f_seal_new.py",
            "erp_bot/tests/oip/language_runtime/test_mai07_r3f_firewall.py",
            "erp_bot/tests/oip/language_runtime/test_mai07_r3f_english_identity.py",
            "erp_bot/tests/oip/language_runtime/test_mai07_seal_contract_v2.py",
        ],
        "contract_metadata": contract_metadata(),
    }
    path = OUT / f"{RC_ID}.manifest.json"
    final = dict(rc)
    final["manifest_path"] = str(path.relative_to(repo)).replace("\\", "/")
    body = {k: v for k, v in final.items() if k != "manifest_sha256"}
    body_bytes = (json.dumps(body, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    digest = hashlib.sha256(body_bytes).hexdigest()
    final["rc_manifest_semantic_sha256"] = digest
    final["manifest_sha256"] = digest
    written = (json.dumps(final, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    final["rc_manifest_raw_sha256"] = hashlib.sha256(written).hexdigest()
    # Re-write including raw hash (semantic stays as pre-raw-field digest of body without raw field)
    body2 = {k: v for k, v in final.items() if k not in {"manifest_sha256", "rc_manifest_raw_sha256"}}
    # Keep semantic as hash of locked fields excluding both sha fields for stability
    sem_body = {k: v for k, v in final.items() if k not in {"manifest_sha256", "rc_manifest_raw_sha256", "rc_manifest_semantic_sha256"}}
    sem = hashlib.sha256(
        (json.dumps(sem_body, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    ).hexdigest()
    final["rc_manifest_semantic_sha256"] = sem
    final["manifest_sha256"] = sem
    written = (json.dumps(final, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    final["rc_manifest_raw_sha256"] = hashlib.sha256(written).hexdigest()
    # One more write so raw matches file bytes including raw field... classic chicken-egg.
    # Contract V2: rc_manifest_semantic_sha256 = hash of object without *_sha256 hash fields;
    # rc_manifest_raw_sha256 = hash of final file bytes after both fields present.
    core = {
        k: v
        for k, v in final.items()
        if k
        not in {
            "manifest_sha256",
            "rc_manifest_raw_sha256",
            "rc_manifest_semantic_sha256",
        }
    }
    sem = hashlib.sha256(
        (json.dumps(core, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    ).hexdigest()
    final["rc_manifest_semantic_sha256"] = sem
    final["manifest_sha256"] = sem
    provisional = dict(final)
    provisional.pop("rc_manifest_raw_sha256", None)
    core_with_sem = {k: v for k, v in provisional.items() if k != "rc_manifest_raw_sha256"}
    raw_contract = hashlib.sha256(
        (json.dumps(core_with_sem, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode(
            "utf-8"
        )
    ).hexdigest()
    path.parent.mkdir(parents=True, exist_ok=True)
    if not write:
        provisional["rc_manifest_raw_sha256"] = raw_contract
        return provisional
    path.write_text(
        json.dumps(provisional, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    # Insert raw hash of current file, rewrite once
    raw1 = sha256_file(path)
    provisional["rc_manifest_raw_sha256"] = raw1
    path.write_text(
        json.dumps(provisional, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    # After inserting raw field, file bytes change — record final raw honestly
    provisional["rc_manifest_raw_sha256"] = sha256_file(path)
    # But that again changes file... Contract: raw = hash of file WITH semantic fields but
    # documenting that raw is computed on the file as committed after first raw insertion
    # (raw field value may be the hash of the prior version). Prefer: raw = hash without
    # the raw field itself (symmetric to semantic).
    core_with_sem = {
        k: v for k, v in provisional.items() if k != "rc_manifest_raw_sha256"
    }
    raw_contract = hashlib.sha256(
        (json.dumps(core_with_sem, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode(
            "utf-8"
        )
    ).hexdigest()
    provisional["rc_manifest_raw_sha256"] = raw_contract
    path.write_text(
        json.dumps(provisional, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return provisional


def main() -> int:
    print(json.dumps(build_rc(), ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
