"""MAI-07R3G-REAUTHORIZED — frozen-V2 eval of SEAL-NEW RC (preflight + one-shot).

Evaluation-only. Uses replacement RC mai-07.1.3-r3f-sealnew only.
Does not overwrite blocked historical R3G under evals/mai07/r3g/.
"""

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
    PARENT_R3E_ATTEMPT_HASH,
    PARENT_R3F_INVALIDATED_RC_HASH,
    PARENT_R3F_INVALIDATED_RESOURCE_CLAIM,
    PARENT_R3F_INVALIDATED_STATUS,
    RESOURCE_PACK_VERSION,
    RUNTIME_VERSION,
)
from ..infrastructure import resource_repository as xlrr
from ..infrastructure.seal_contract_v2 import (
    SEAL_CONTRACT_VERSION,
    build_resource_seal_fields,
    contract_metadata,
    predictions_canonical_list_sha256,
    predictions_jsonl_raw_sha256,
    sha256_file,
)

REPO = Path(__file__).resolve().parents[7]
SEAL_NEW = REPO / "evals/mai07_r3f_seal_new"
OLD_R3F = REPO / "evals/mai07_r3f_english_identity"
BLOCKED_R3G = REPO / "evals/mai07/r3g"
OUT = REPO / "evals/mai07/r3g_reauthorized"
REPORTS = OUT / "reports"
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
APP = XL / "application"

EXPECTED = {
    "runtime": "mai-07.1.3-r3f-sealnew",
    "resource": "1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930",
    "rc_lock_before_holdout": "f4c07e24cb78550496720881fbc2b6019650006f8bd39eedd716fd046b6107ff",
    "rc_post_holdout_semantic": "530192228e7827bc33213f7ad8a3f4c2b75bdba6a01d78611617fd2d27c10e5c",
    "fresh_pred_raw": "0f1c72f8ee38e457c7d132dc03553f4299d59f80fa956752e97660cab9a7c09c",
    "fresh_pred_canon": "ba64b365718018c213c0a6955bcfb4c8b8f9c6f465e328113e662e161d26f2c4",
    "dataset_manifest": "ad46b4fb519f683f64371992d2f0efef6ba40be5d267e8cc328ed6d74b20dc48",
    "invalidated_rc": "37e551f29126fea63f77b9cb6b3bc4e867185b61a620b5686ed8471bf10396dd",
    "invalidated_resource_claim": "e94cc8c7775d9ce77ab854ab478387d950a018ba1b76d96e9749d4aad425e50a",
    "r3e_attempt": "833233e4f5ed5250a824e47dcfec000fa4d66ae20dfeec1729822e43bf81fbd2",
    "r3e_pred": "89ee4789333bc1fd5b5ea3b1b505c0a53b7a5f7e159d5966511ead52735a7e9c",
    "v1": "5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208",
    "v2": "0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9",
    "v2_man": "17331e4d0c703977b80ca893eb5261bb126aa52a6813fe8b4f548b1178c716be",
    "pop": "a8461f62acac98561605e5b2ffb2475bb73a3d15cf0f32ef7b98f1247de85632",
    "thr": "aa4b5d68852edbed7cdc5f025b8051b3235078a65fb78bb0aca3a342fcdf04ef",
    "canonical_scorer_lf": "6e8e30c9c6e2c38d3ea61243e0a22a72e8eb3e17e3d854a0a9a3467b130e9336",
    "audit_scorer_lf": "c0d7799b5d54057ea768b8c67f9516edefc713d8ebd2d59120f16df3bc102450",
    "forensic_cited": "c568464d691a7edd5797469d7209e2a6d0b92fdd1c6fd38e73ae43c3295243b5",
}


def _sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha_file(path: Path) -> str:
    return _sha_bytes(path.read_bytes())


def _sha_lf(path: Path) -> str:
    return _sha_bytes(path.read_bytes().replace(b"\r\n", b"\n").replace(b"\r", b"\n"))


def _canonical(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def recompute_v1_hash(repo: Path = REPO) -> str:
    man = json.loads(
        (repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    h = hashlib.sha256()
    for f in sorted(man["files"], key=lambda x: x["suite_id"]):
        h.update(f["suite_id"].encode())
        h.update(b"\0")
        h.update((repo / f["path"]).read_bytes())
    return h.hexdigest()


def recompute_v2_hash(repo: Path = REPO) -> str:
    man = json.loads(
        (repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    h = hashlib.sha256()
    for f in sorted(man["files"], key=lambda x: x["suite_id"]):
        h.update(f["suite_id"].encode())
        h.update(b"\0")
        h.update((repo / f["path"]).read_bytes())
    return h.hexdigest()


def find_lock_before_holdout_artifact(repo: Path = REPO) -> dict[str, Any]:
    """Require preserved immutable LOCKED_NOT_RUN body hashing to f4c07e24… (A),
    or append-only lock record containing complete locked RC body (B).
    Narrative hash strings alone are insufficient.
    """
    target = EXPECTED["rc_lock_before_holdout"]
    seal_new = repo / "evals/mai07_r3f_seal_new"
    hits: list[dict[str, Any]] = []
    narrative_refs: list[str] = []

    for p in seal_new.rglob("*"):
        if not p.is_file() or p.stat().st_size > 5_000_000:
            continue
        raw = p.read_bytes()
        raw_h = _sha_bytes(raw)
        rel = str(p.relative_to(repo)).replace("\\", "/")
        if raw_h == target:
            hits.append({"path": rel, "match": "raw_file_sha256", "sha256": raw_h})
        if p.suffix == ".json":
            try:
                obj = json.loads(raw)
            except Exception:
                continue
            if not isinstance(obj, dict):
                continue
            for key in (
                "manifest_sha256",
                "rc_manifest_semantic_sha256",
                "rc_manifest_sha256",
                "rc_manifest_sha256_locked_before_holdout",
            ):
                if obj.get(key) == target:
                    # Field reference only — not a body
                    narrative_refs.append(f"{rel}:{key}")
            # Complete body option B: object embeds locked_rc_body + hash
            if obj.get("locked_rc_body") and isinstance(obj["locked_rc_body"], dict):
                body = obj["locked_rc_body"]
                core = {
                    k: v
                    for k, v in body.items()
                    if k
                    not in {
                        "manifest_sha256",
                        "rc_manifest_raw_sha256",
                        "rc_manifest_semantic_sha256",
                    }
                }
                sem = _sha_bytes(
                    (json.dumps(core, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode(
                        "utf-8"
                    )
                )
                if sem == target or obj.get("locked_rc_hash") == target:
                    hits.append(
                        {
                            "path": rel,
                            "match": "append_only_lock_record",
                            "sha256": sem,
                        }
                    )
            # Dedicated immutable LOCKED_NOT_RUN artifact
            if p.name.endswith(".LOCKED_NOT_RUN.json") and obj.get("status") == "LOCKED_NOT_RUN":
                core = {
                    k: v
                    for k, v in obj.items()
                    if k
                    not in {
                        "manifest_sha256",
                        "rc_manifest_raw_sha256",
                        "rc_manifest_semantic_sha256",
                    }
                }
                sem = _sha_bytes(
                    (json.dumps(core, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode(
                        "utf-8"
                    )
                )
                if sem == target:
                    hits.append({"path": rel, "match": "immutable_locked_not_run_file", "sha256": sem})
            # Legacy combined manifest snapshot (deprecated; prefer .LOCKED_NOT_RUN.json)
            elif obj.get("status") == "LOCKED_NOT_RUN" and obj.get("manifest_id") == (
                "MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001"
            ):
                core = {
                    k: v
                    for k, v in obj.items()
                    if k
                    not in {
                        "manifest_sha256",
                        "rc_manifest_raw_sha256",
                        "rc_manifest_semantic_sha256",
                    }
                }
                sem = _sha_bytes(
                    (json.dumps(core, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode(
                        "utf-8"
                    )
                )
                if sem == target:
                    hits.append({"path": rel, "match": "locked_not_run_snapshot", "sha256": sem})

    return {
        "ok": bool(hits),
        "target_hash": target,
        "immutable_hits": hits,
        "narrative_refs_only": narrative_refs,
        "reason": (
            None
            if hits
            else (
                "No preserved immutable lock-before-holdout artifact whose body hashes to "
                f"{target}. Found narrative references only: {narrative_refs}. "
                "mtime/narrative insufficient per MAI-07R3G-REAUTHORIZED lock-chain rule."
            )
        ),
    }


def validate_lineage(repo: Path = REPO) -> dict[str, Any]:
    errors: list[str] = []
    xlrr.load_resources(force_reload=True)

    if RUNTIME_VERSION != EXPECTED["runtime"]:
        errors.append(f"runtime:{RUNTIME_VERSION}")
    if RESOURCE_PACK_VERSION != EXPECTED["runtime"]:
        errors.append(f"pack_version:{RESOURCE_PACK_VERSION}")
    if ENABLE_PROMOTION_OVERLAY is not False:
        errors.append("overlay_enabled")
    if "sealed_packs" not in str(xlrr.RESOURCES_DIR).replace("\\", "/") or "mai-07.1.3-r3f-sealnew" not in str(
        xlrr.RESOURCES_DIR
    ):
        errors.append(f"active_resources_dir:{xlrr.RESOURCES_DIR}")
    if xlrr.RESOURCES_DIR.resolve() == xlrr.HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR.resolve():
        errors.append("historical_resources_still_active")

    pack = xlrr.compute_pack_content_hash()
    if pack != EXPECTED["resource"]:
        errors.append(f"resource_content:{pack}")
    val = xlrr.validate_resources()
    if not val["ok"] or val["content_hash"] != val["claimed_content_hash"]:
        errors.append(f"resource_claim_mismatch:{val}")

    man = json.loads((xlrr.RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8"))
    seal_v2 = build_resource_seal_fields(resources_dir=xlrr.RESOURCES_DIR, manifest=man)
    if seal_v2["resource_content_sha256"] != EXPECTED["resource"]:
        errors.append("seal_v2_content_mismatch")

    hist = json.loads(
        (xlrr.HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR / "manifest.json").read_text(encoding="utf-8")
    )
    if hist.get("content_hash") != EXPECTED["invalidated_resource_claim"]:
        errors.append("historical_claim_drift")

    old_rc_path = OLD_R3F / "MAI_07R3F_RELEASE_CANDIDATE.manifest.json"
    old_rc = json.loads(old_rc_path.read_text(encoding="utf-8"))
    old_body = {k: v for k, v in old_rc.items() if k != "manifest_sha256"}
    old_sem = _sha_bytes(
        (json.dumps(old_body, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    )
    if old_sem != EXPECTED["invalidated_rc"] or old_rc.get("manifest_sha256") != EXPECTED["invalidated_rc"]:
        errors.append("invalidated_rc_drift")
    inv = OLD_R3F / "MAI_07R3F_RELEASE_CANDIDATE.INVALIDATION.json"
    if not inv.exists():
        errors.append("missing_invalidation_sidecar")
    else:
        inv_obj = json.loads(inv.read_text(encoding="utf-8"))
        if inv_obj.get("parent_rc_status") != PARENT_R3F_INVALIDATED_STATUS:
            errors.append("invalidation_status_drift")

    rc_path = SEAL_NEW / "MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001.manifest.json"
    rc = json.loads(rc_path.read_text(encoding="utf-8"))
    post_sem = rc.get("manifest_sha256")
    if post_sem != EXPECTED["rc_post_holdout_semantic"]:
        errors.append(f"post_holdout_rc_semantic:{post_sem}")
    if rc.get("parent_rc_status") != "INVALIDATED_BY_SEAL_DRIFT":
        errors.append("parent_status_missing")
    if rc.get("parent_rc_manifest_sha256") != EXPECTED["invalidated_rc"]:
        errors.append("parent_rc_hash_mismatch")
    if rc.get("resource_content_sha256") != EXPECTED["resource"]:
        errors.append("rc_resource_mismatch")
    if rc.get("seal_contract_version") != SEAL_CONTRACT_VERSION:
        errors.append("seal_contract_version_mismatch")

    # Fresh holdout evidence
    pred_path = SEAL_NEW / "reports/MAI_07R3F_SEAL_NEW_HOLDOUT_VALIDATION_PREDICTIONS.jsonl"
    rep_path = SEAL_NEW / "reports/MAI_07R3F_SEAL_NEW_HOLDOUT_VALIDATION_SCORE_REPORT.json"
    preds = [json.loads(ln) for ln in pred_path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    raw_h = predictions_jsonl_raw_sha256(pred_path)
    canon_h = predictions_canonical_list_sha256(preds)
    if raw_h != EXPECTED["fresh_pred_raw"]:
        errors.append(f"fresh_pred_raw:{raw_h}")
    if canon_h != EXPECTED["fresh_pred_canon"]:
        errors.append(f"fresh_pred_canon:{canon_h}")
    rep = json.loads(rep_path.read_text(encoding="utf-8"))
    if rep.get("predictions_jsonl_raw_sha256") != raw_h:
        errors.append("holdout_report_raw_mismatch")
    if rep.get("predictions_canonical_list_sha256") != canon_h:
        errors.append("holdout_report_canon_mismatch")
    if rep["report"]["metrics"] != rep["audit"]["metrics"]:
        errors.append("holdout_canon_audit_disagree")
    if not rep["gate_decision"]["all_pass"]:
        errors.append("holdout_gates_failed")
    if rep.get("rc_manifest_sha256") != EXPECTED["rc_lock_before_holdout"]:
        errors.append("holdout_report_lock_hash_field_unexpected")

    ds_h = _sha_file(SEAL_NEW / "MAI_07R3F_SEAL_NEW_DATASET_MANIFEST.json")
    if ds_h != EXPECTED["dataset_manifest"]:
        errors.append(f"dataset_manifest:{ds_h}")

    thr_h = _sha_file(SEAL_NEW / "MAI_07R3F_SEAL_NEW_HOLDOUT_THRESHOLDS.json")

    # Frozen authorities
    if recompute_v1_hash(repo) != EXPECTED["v1"]:
        errors.append("v1_drift")
    if recompute_v2_hash(repo) != EXPECTED["v2"]:
        errors.append("v2_drift")
    if _sha_file(repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V2.manifest.json") != EXPECTED[
        "v2_man"
    ]:
        errors.append("v2_man_drift")
    if _sha_file(repo / "evals/mai07/manifests/MAI_07_R3C_POPULATIONS_V2.manifest.json") != EXPECTED["pop"]:
        errors.append("pop_drift")
    if _sha_file(repo / "evals/mai07/manifests/MAI_07_R3C_THRESHOLDS_V1.manifest.json") != EXPECTED["thr"]:
        errors.append("thr_drift")
    if _sha_lf(APP / "eval_scoring_r3c.py") != EXPECTED["canonical_scorer_lf"]:
        errors.append("canonical_scorer_drift")
    if _sha_lf(APP / "eval_audit_scorer_r3c.py") != EXPECTED["audit_scorer_lf"]:
        errors.append("audit_scorer_drift")

    r3e = json.loads(
        (repo / "evals/mai07/r3e/MAI_07R3E_FROZEN_V2_ATTEMPT.manifest.json").read_text(encoding="utf-8")
    )
    if r3e.get("manifest_content_sha256") != EXPECTED["r3e_attempt"]:
        errors.append("r3e_attempt_drift")
    if _sha_file(repo / "evals/mai07/r3e/reports/MAI_07R3E_V2_ONE_SHOT_PREDICTIONS.jsonl") != EXPECTED[
        "r3e_pred"
    ]:
        errors.append("r3e_pred_drift")

    blocked = BLOCKED_R3G / "reports/MAI_07R3G_PREFLIGHT_REPORT.json"
    blocked_hash = _sha_file(blocked) if blocked.exists() else None
    forensic = (
        repo
        / "evals/mai07_r3f_seal_restore/forensics/MAI_07R3F_SEAL_FORENSIC_SNAPSHOT.manifest.json"
    )
    forensic_raw = _sha_file(forensic) if forensic.exists() else None

    lock_chain = find_lock_before_holdout_artifact(repo)
    if not lock_chain["ok"]:
        errors.append("lock_before_holdout_artifact_missing")

    return {
        "ok": not errors,
        "errors": errors,
        "runtime_version": RUNTIME_VERSION,
        "resource_pack_version": RESOURCE_PACK_VERSION,
        "resource_content_sha256": pack,
        "seal_v2": seal_v2,
        "resources_dir": str(xlrr.RESOURCES_DIR.relative_to(repo)).replace("\\", "/"),
        "historical_resources_dir": str(
            xlrr.HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR.relative_to(repo)
        ).replace("\\", "/"),
        "post_holdout_rc_manifest_sha256": post_sem,
        "post_holdout_rc_file_raw_sha256": _sha_file(rc_path),
        "fresh_holdout_threshold_sha256": thr_h,
        "fresh_predictions_raw": raw_h,
        "fresh_predictions_canonical": canon_h,
        "lock_chain": lock_chain,
        "blocked_r3g_preflight_sha256": blocked_hash,
        "forensic_snapshot_raw_sha256": forensic_raw,
        "forensic_cited_historical": EXPECTED["forensic_cited"],
        "forensic_discrepancy": forensic_raw != EXPECTED["forensic_cited"],
        "invalidated_parent_status": PARENT_R3F_INVALIDATED_STATUS,
        "invalidated_parent_rc": PARENT_R3F_INVALIDATED_RC_HASH,
        "guard_version": ENGLISH_IDENTITY_GUARD_VERSION,
        "overlay": ENABLE_PROMOTION_OVERLAY,
        "r3e_attempt": PARENT_R3E_ATTEMPT_HASH,
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "contract_metadata": contract_metadata(),
    }


def write_preflight_bundle(repo: Path = REPO) -> dict[str, Any]:
    REPORTS.mkdir(parents=True, exist_ok=True)
    lineage = validate_lineage(repo)
    status = "PREFLIGHT_OK" if lineage["ok"] else "BLOCKED_PRECONDITION_FAILED"
    bundle = {
        "phase": "MAI-07R3G-REAUTHORIZED",
        "status": status,
        "authorization": "EXPLICIT_USER_AUTHORIZATION_R3G_REAUTHORIZED",
        "lineage": lineage,
        "frozen_v2_opened": False,
        "attempt_locked": False,
        "one_shot_executed": False,
        "quality_verdict": None,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "environment_fingerprint": {
            "python": sys.version.split()[0],
            "platform": platform.platform(),
            "machine": platform.machine(),
        },
        "note": (
            "Frozen V2 must not be opened when status != PREFLIGHT_OK. "
            "Lock-before-holdout requires preserved immutable RC body (hash f4c07e24…) "
            "or append-only lock record containing that body — narrative hash fields are insufficient."
        ),
        "recommended_next_if_blocked": "MAI-07R3F-SEAL-LOCK-CHAIN",
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "QUALITY_GATES_PASSED": False,
    }
    historical = REPORTS / "MAI_07R3G_REAUTHORIZED_PREFLIGHT_REPORT.json"
    current = REPORTS / "MAI_07R3G_REAUTHORIZED_002_PREFLIGHT_REPORT.json"
    if historical.exists():
        prior = json.loads(historical.read_text(encoding="utf-8"))
        if prior.get("status") == "BLOCKED_PRECONDITION_FAILED":
            current.write_text(
                json.dumps(bundle, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            bundle["historical_blocked_preflight_preserved"] = str(
                historical.relative_to(repo)
            ).replace("\\", "/")
            bundle["written_to"] = str(current.relative_to(repo)).replace("\\", "/")
            return bundle
    path = historical
    path.write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    bundle["preflight_path"] = str(path.relative_to(repo)).replace("\\", "/")
    bundle["preflight_sha256"] = _sha_file(path)
    return bundle


def lock_attempt_refuse_if_blocked(repo: Path = REPO) -> dict[str, Any]:
    """Create LOCKED attempt only when preflight OK. Otherwise refuse."""
    bundle = write_preflight_bundle(repo)
    if bundle["status"] != "PREFLIGHT_OK":
        return {
            "ok": False,
            "status": "BLOCKED_PRECONDITION_FAILED",
            "attempt_locked": False,
            "frozen_v2_opened": False,
            "preflight": bundle,
            "error": "refusing to lock attempt; lock-chain / lineage preflight failed",
        }
    raise NotImplementedError("attempt lock path not reached while blocked")


def execute_refuse_if_blocked(repo: Path = REPO) -> dict[str, Any]:
    out = lock_attempt_refuse_if_blocked(repo)
    if not out.get("ok"):
        return out
    raise NotImplementedError("execution path not reached while blocked")


def main() -> int:
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--preflight", action="store_true")
    p.add_argument("--lock-attempt", action="store_true")
    p.add_argument("--execute", action="store_true")
    args = p.parse_args()
    if args.execute:
        out = execute_refuse_if_blocked()
    elif args.lock_attempt:
        out = lock_attempt_refuse_if_blocked()
    else:
        out = write_preflight_bundle()
    print(json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True))
    if out.get("status") == "BLOCKED_PRECONDITION_FAILED" or out.get("ok") is False:
        return 2
    return 0 if out.get("status") == "PREFLIGHT_OK" or out.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
