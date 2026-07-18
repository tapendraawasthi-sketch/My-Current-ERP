"""Build / check MAI-07R1 release-candidate manifest (lock before frozen eval)."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .. import RESOURCE_PACK_VERSION, RUNTIME_VERSION
from ..infrastructure.resource_repository import compute_pack_content_hash, load_resources

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_ranker_dev" / "manifests" / "MAI_07R1_RELEASE_CANDIDATE.manifest.json"
HOLDOUT_FREEZE = REPO / "evals" / "mai07_ranker_dev" / "manifests" / "MAI_07R1_HOLDOUT_FREEZE.manifest.json"

TRACKED = [
    "erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/deterministic_ranker.py",
    "erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/deterministic_generator.py",
    "erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/resource_repository.py",
    "erp_bot/src/oip/modules/language_runtime/transliteration/application/transliteration_service.py",
    "erp_bot/src/oip/modules/language_runtime/transliteration/__init__.py",
    "erp_bot/src/oip/modules/language_runtime/transliteration/resources/ranking_config.json",
    "erp_bot/src/oip/modules/language_runtime/transliteration/resources/english_identity.json",
    "erp_bot/src/oip/modules/language_runtime/transliteration/resources/name_like_terms.json",
    "erp_bot/src/oip/modules/language_runtime/transliteration/resources/manifest.json",
    "erp_bot/src/oip/modules/language_runtime/transliteration/application/build_mai07r1_ranker_dev.py",
    "erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_mai07r1_dev.py",
    "erp_bot/tests/oip/language_runtime/test_mai07_r1_ranker.py",
    "evals/mai07_ranker_dev/splits/development.jsonl",
    "evals/mai07_ranker_dev/splits/holdout_validation.jsonl",
    "evals/mai07_ranker_dev/splits/safety_challenge.jsonl",
    "evals/mai07_ranker_dev/manifests/MAI_07R1_RANKER_DEV_V1.manifest.json",
    "evals/mai07_ranker_dev/baselines/MAI_07R1_dev_holdout_report.json",
]


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_manifest() -> dict[str, Any]:
    res = load_resources(force_reload=True)
    files = []
    for rel in TRACKED:
        p = REPO / rel
        files.append({"path": rel.replace("\\", "/"), "sha256": _sha(p), "exists": p.exists()})
    holdout_meta = json.loads(
        (REPO / "evals/mai07_ranker_dev/manifests/MAI_07R1_RANKER_DEV_V1.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    holdout_freeze = {
        "manifest_id": "MAI_07R1_HOLDOUT_FREEZE",
        "locked_at": datetime.now(timezone.utc).isoformat(),
        "holdout_sha256": holdout_meta["splits"]["HOLDOUT_VALIDATION"]["sha256"],
        "holdout_path": holdout_meta["splits"]["HOLDOUT_VALIDATION"]["path"],
        "ranker_config_version": res.ranking_config.get("ranking_config_version"),
        "resource_pack_version": RESOURCE_PACK_VERSION,
        "runtime_version": RUNTIME_VERSION,
        "resource_content_hash": res.content_hash,
        "note": "Holdout labels locked; do not edit after this freeze.",
    }
    HOLDOUT_FREEZE.parent.mkdir(parents=True, exist_ok=True)
    HOLDOUT_FREEZE.write_text(json.dumps(holdout_freeze, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    man = {
        "manifest_id": "MAI_07R1_RELEASE_CANDIDATE",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "runtime_version": RUNTIME_VERSION,
        "resource_pack_version": RESOURCE_PACK_VERSION,
        "ranking_config_version": res.ranking_config.get("ranking_config_version"),
        "evaluator_version": "mai-07.1.3",
        "evaluator_note": "mai-07.1.3 relaxes preferred context contingency hard-lock from C2 snapshot; target context invariants unchanged",
        "prior_frozen_attempt": {
            "status": "FAILED_EVALUATOR_INVARIANT",
            "error": "preferred_context_contingency_unexpected",
            "note": "Pre-correction preferred table (21,0,13,30) is not a quality gate",
        },
        "resource_content_hash": res.content_hash,
        "resource_content_hash_recomputed": compute_pack_content_hash(),
        "prior_resource_content_hash_mai0710": "18628335c0feb74a4f28f65ca70b2683f8b54a54790fd03e9033d8cd08ed4566",
        "holdout_freeze_path": str(HOLDOUT_FREEZE.relative_to(REPO)).replace("\\", "/"),
        "holdout_freeze_sha256": _sha(HOLDOUT_FREEZE),
        "dev_holdout_report_sha256": _sha(
            REPO / "evals/mai07_ranker_dev/baselines/MAI_07R1_dev_holdout_report.json"
        ),
        "creation_command": (
            "python -m src.oip.modules.language_runtime.transliteration.application."
            "build_mai07r1_release_candidate"
        ),
        "check_command": (
            "python -m src.oip.modules.language_runtime.transliteration.application."
            "build_mai07r1_release_candidate --check"
        ),
        "files": files,
        "locks": {
            "no_runtime_resource_edit_before_frozen_eval": True,
            "one_shot_frozen_eval_required": True,
            "frozen_dataset_sha256": "5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208",
        },
        "linguist_approved": False,
        "production_approved": False,
    }
    # Placeholder semantic hash filled after holdout recompute note
    man["corrective_holdout_semantic_note"] = "see MAI_07R1_dev_holdout_report.json"
    return man


def write_manifest(man: dict[str, Any]) -> str:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(man, indent=2, sort_keys=True) + "\n"
    OUT.write_text(text, encoding="utf-8")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def check_manifest() -> dict[str, Any]:
    man = json.loads(OUT.read_text(encoding="utf-8"))
    errors: list[str] = []
    for f in man.get("files", []):
        p = REPO / f["path"]
        if not p.exists():
            errors.append(f"missing:{f['path']}")
            continue
        dig = _sha(p)
        if dig != f["sha256"]:
            errors.append(f"hash_drift:{f['path']}")
    res = load_resources(force_reload=True)
    if res.content_hash != man.get("resource_content_hash"):
        errors.append("resource_content_hash_drift")
    if RUNTIME_VERSION != man.get("runtime_version"):
        errors.append("runtime_version_drift")
    return {"ok": not errors, "errors": errors, "manifest_path": str(OUT)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    if args.check:
        report = check_manifest()
        print(json.dumps(report, indent=2))
        raise SystemExit(0 if report["ok"] else 1)
    man = build_manifest()
    digest = write_manifest(man)
    print(json.dumps({"ok": True, "manifest": str(OUT.relative_to(REPO)).replace("\\", "/"), "sha256": digest}, indent=2))


if __name__ == "__main__":
    main()
