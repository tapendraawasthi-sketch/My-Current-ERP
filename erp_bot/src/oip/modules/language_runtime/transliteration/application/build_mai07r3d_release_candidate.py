"""MAI-07R3D release-candidate lock (non-frozen). Must precede one-shot holdout."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from .. import (
    ENABLE_PROMOTION_OVERLAY,
    PARENT_PRE_R1_RESOURCE_HASH,
    PARENT_PRE_R1_RUNTIME_VERSION,
    RESOURCE_PACK_VERSION,
    RUNTIME_VERSION,
)
from ..infrastructure.resource_repository import compute_pack_content_hash, load_resources

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3d_corrective"
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"


def _sha_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _sha_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def code_semantic_hash() -> str:
    files = [
        XL / "application/transliteration_service.py",
        XL / "infrastructure/deterministic_ranker.py",
        XL / "infrastructure/deterministic_generator.py",
        XL / "infrastructure/r3d_safety_gate.py",
        XL / "__init__.py",
    ]
    h = hashlib.sha256()
    for p in sorted(files):
        h.update(p.name.encode())
        h.update(b"\0")
        h.update(p.read_bytes())
    return h.hexdigest()


def build_rc(repo: Path = REPO) -> dict[str, Any]:
    load_resources(force_reload=True)
    if ENABLE_PROMOTION_OVERLAY:
        raise RuntimeError("overlay must be disabled for R3D RC")
    ds = json.loads((OUT / "MAI_07R3D_DATASET_MANIFEST.json").read_text(encoding="utf-8"))
    thr = (OUT / "MAI_07R3D_HOLDOUT_THRESHOLDS.json").read_bytes()
    res_hash = compute_pack_content_hash()
    semantic = code_semantic_hash()
    rc = {
        "schema_version": "1.0.0",
        "manifest_id": "MAI_07R3D_RELEASE_CANDIDATE",
        "locked": True,
        "locked_before_holdout": True,
        "runtime_version": RUNTIME_VERSION,
        "resource_pack_version": RESOURCE_PACK_VERSION,
        "resource_content_hash": res_hash,
        "code_semantic_hash": semantic,
        "parent_pre_r1_runtime_version": PARENT_PRE_R1_RUNTIME_VERSION,
        "parent_pre_r1_resource_hash": PARENT_PRE_R1_RESOURCE_HASH,
        "parent_frozen_v1_hash": "5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208",
        "parent_frozen_v2_hash": "0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9",
        "development_dataset_sha256": ds["splits"]["DEVELOPMENT"]["sha256"],
        "holdout_dataset_sha256": ds["splits"]["HOLDOUT_VALIDATION"]["sha256"],
        "safety_dataset_sha256": ds["splits"]["SAFETY_CHALLENGE"]["sha256"],
        "dataset_manifest_sha256": _sha_file(OUT / "MAI_07R3D_DATASET_MANIFEST.json"),
        "threshold_sha256": hashlib.sha256(thr).hexdigest(),
        "ENABLE_PROMOTION_OVERLAY": False,
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "QUALITY_GATES_PASSED": False,
        "note": "Non-frozen RC only. Frozen V2 evaluation reserved for MAI-07R3E.",
        "test_manifest": [
            "erp_bot/tests/oip/language_runtime/test_mai07_r3d_firewall.py",
            "erp_bot/tests/oip/language_runtime/test_mai07_r3d_corrective.py",
        ],
    }
    body = json.dumps(rc, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    path = OUT / "MAI_07R3D_RELEASE_CANDIDATE.manifest.json"
    path.write_text(body, encoding="utf-8", newline="\n")
    rc["manifest_path"] = str(path.relative_to(repo)).replace("\\", "/")
    rc["manifest_sha256"] = hashlib.sha256(body.encode("utf-8")).hexdigest()
    # rewrite with self hash
    rc_out = {k: v for k, v in rc.items() if k != "manifest_sha256"}
    rc_out["manifest_sha256"] = hashlib.sha256(
        (json.dumps(rc_out, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    ).hexdigest()
    # Simpler: store hash of content without self-reference
    final = {k: v for k, v in rc.items() if k not in {"manifest_sha256"}}
    final_body = json.dumps(final, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    digest = hashlib.sha256(final_body.encode("utf-8")).hexdigest()
    final["manifest_sha256"] = digest
    path.write_text(json.dumps(final, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    return final


def main() -> int:
    print(json.dumps(build_rc(), ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
