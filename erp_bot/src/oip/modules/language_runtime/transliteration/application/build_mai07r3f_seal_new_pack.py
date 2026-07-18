"""Build immutable versioned resource pack mai-07.1.3-r3f-sealnew.

Does not reseal historical resources/ in place. Builds twice in temp dirs,
requires byte-identical outputs, then promotes once to sealed_packs/.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from ..infrastructure.seal_contract_v2 import (
    SEAL_CONTRACT_VERSION,
    build_resource_seal_fields,
    resource_content_sha256,
    sha256_bytes,
    sha256_file,
)

REPO = Path(__file__).resolve().parents[7]
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
HISTORICAL_DIR = XL / "resources"
PACK_VERSION = "mai-07.1.3-r3f-sealnew"
PACK_ID = "mai07_transliteration_pack_r3f_sealnew"
SEALED_ROOT = XL / "sealed_packs"
DEST = SEALED_ROOT / PACK_VERSION

ALLOWED_FILES = [
    "romanized_lexicon.json",
    "grapheme_rules.json",
    "morphology_rules.json",
    "ambiguity_rules.json",
    "domain_terms.json",
    "context_rules.json",
    "english_identity.json",
    "name_like_terms.json",
    "ranking_config.json",
    "r3d_safety_disposition.json",
    "r3f_english_identity_guard.json",
]

FORBIDDEN_NAME_FRAGMENTS = (
    "forensic",
    "eval",
    "prediction",
    "holdout",
    "tmp",
    "temp",
    ".bak",
    "INVALIDATED",
)


def _write_json(path: Path, obj: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def _copy_allowed(src_dir: Path, dest_dir: Path) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    present = {p.name for p in src_dir.iterdir() if p.is_file()}
    for name in ALLOWED_FILES:
        if name not in present:
            raise FileNotFoundError(f"missing required resource file: {name}")
        shutil.copy2(src_dir / name, dest_dir / name)
    # Reject unexpected evaluation/temp JSON artifacts that look like pack members.
    for name in present:
        low = name.lower()
        if name in ALLOWED_FILES or name == "manifest.json":
            continue
        if name == "promotion_overlay_config.json":
            continue  # historical optional; never copied into sealed pack
        if any(f in low for f in FORBIDDEN_NAME_FRAGMENTS):
            raise RuntimeError(f"forbidden artifact in source resources: {name}")


def _build_manifest(content_hash: str, *, seal_fields: dict[str, Any] | None = None) -> dict[str, Any]:
    man: dict[str, Any] = {
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "SEALED_READ_ONLY": True,
        "allowed_use": ["candidate_transliteration", "engineering_eval"],
        "content_hash": content_hash,
        "experimental_overlay_status": "DISABLED_NON_AUTHORITATIVE",
        "files": list(ALLOWED_FILES),
        "license_status": "INTERNAL_ENGINEERING",
        "limits": {
            "max_beam_width": 32,
            "max_candidates_per_span": 5,
            "max_eligible_spans": 128,
            "max_hypotheses": 5,
            "max_total_candidates": 400,
        },
        "parent_invalidated_r3f_content_hash_claim": (
            "e94cc8c7775d9ce77ab854ab478387d950a018ba1b76d96e9749d4aad425e50a"
        ),
        "parent_invalidated_r3f_rc_hash": (
            "37e551f29126fea63f77b9cb6b3bc4e867185b61a620b5686ed8471bf10396dd"
        ),
        "parent_invalidated_r3f_status": "INVALIDATED_BY_SEAL_DRIFT",
        "prior_content_hash_mai0710": "18628335c0feb74a4f28f65ca70b2683f8b54a54790fd03e9033d8cd08ed4566",
        "prior_content_hash_mai0711_r3d": "083bce288907c0db882bdf7082bf9093e9086035c653dadcd4964625b61e966f",
        "prior_content_hash_mai0712_r3f_invalidated_claim": (
            "e94cc8c7775d9ce77ab854ab478387d950a018ba1b76d96e9749d4aad425e50a"
        ),
        "prior_content_hash_mai0720_r1_failed": "0f0af894fa282d7134e2ca1cba26a1000f75733fa435588de6a2083abd3d9dc1",
        "prior_content_hash_mai0730_r2_failed": "c1c5a603627868a2ccf8b4c2ff74b1adafaff7eac6e01bf94e289944268e77af",
        "prohibited_use": [
            "training_on_frozen_eval",
            "accounting_truth",
            "auto_apply",
            "ui_render",
            "prompt_injection",
        ],
        "provenance": (
            "MAI-07R3F-SEAL-NEW: new versioned pack from intended R3F resource contents. "
            "Historical e94cc8c claim unrestorable; parent RC INVALIDATED_BY_SEAL_DRIFT. "
            "Decision logic unchanged. Overlay disabled. LINGUIST_APPROVED=false."
        ),
        "resource_id": PACK_ID,
        "resource_pack_version": PACK_VERSION,
        "review_status": "ENGINEERING_CURATED_NOT_LINGUIST_APPROVED",
        "schema_version": "2.0.0",
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "update_date": "2026-07-16",
    }
    if seal_fields:
        man["seal_v2"] = seal_fields
    return man


def _materialize_pack(work: Path, src: Path) -> dict[str, Any]:
    _copy_allowed(src, work)
    content = resource_content_sha256(resources_dir=work, file_names=ALLOWED_FILES)
    man = _build_manifest(content)
    _write_json(work / "manifest.json", man)
    # Refresh seal fields after manifest exists
    seal_fields = build_resource_seal_fields(resources_dir=work, manifest=man)
    assert seal_fields["resource_content_sha256"] == content
    man["seal_v2"] = seal_fields
    man["content_hash"] = content
    _write_json(work / "manifest.json", man)
    # Manifest change does not affect content_hash (files list only)
    assert resource_content_sha256(resources_dir=work, file_names=ALLOWED_FILES) == content
    file_digests = {name: sha256_file(work / name) for name in ["manifest.json", *ALLOWED_FILES]}
    return {
        "content_hash": content,
        "file_digests": file_digests,
        "manifest": man,
    }


def build_pack(*, promote: bool = True) -> dict[str, Any]:
    if not HISTORICAL_DIR.exists():
        raise FileNotFoundError(HISTORICAL_DIR)
    with tempfile.TemporaryDirectory(prefix="mai07_sealnew_a_") as ta, tempfile.TemporaryDirectory(
        prefix="mai07_sealnew_b_"
    ) as tb:
        a = Path(ta)
        b = Path(tb)
        ra = _materialize_pack(a, HISTORICAL_DIR)
        rb = _materialize_pack(b, HISTORICAL_DIR)
        if ra["content_hash"] != rb["content_hash"]:
            raise RuntimeError("pack content hash mismatch between dual builds")
        if ra["file_digests"] != rb["file_digests"]:
            raise RuntimeError("pack file digests mismatch between dual builds")
        # Byte-identical tree for resource files + manifest
        for name in ["manifest.json", *ALLOWED_FILES]:
            if (a / name).read_bytes() != (b / name).read_bytes():
                raise RuntimeError(f"byte mismatch for {name}")
        report = {
            "ok": True,
            "pack_version": PACK_VERSION,
            "resource_content_sha256": ra["content_hash"],
            "dual_build_identical": True,
            "seal_contract_version": SEAL_CONTRACT_VERSION,
            "source_historical_dir": str(HISTORICAL_DIR.relative_to(REPO)).replace("\\", "/"),
            "dest": str(DEST.relative_to(REPO)).replace("\\", "/"),
            "promoted": False,
            "historical_claim_preserved": (
                json.loads((HISTORICAL_DIR / "manifest.json").read_text(encoding="utf-8")).get(
                    "content_hash"
                )
            ),
        }
        if promote:
            if DEST.exists():
                # Refuse overwrite of sealed pack unless empty rebuild authorized
                existing = json.loads((DEST / "manifest.json").read_text(encoding="utf-8"))
                if existing.get("content_hash") == ra["content_hash"] and existing.get("SEALED_READ_ONLY"):
                    report["promoted"] = False
                    report["already_sealed"] = True
                    report["seal_v2"] = existing.get("seal_v2")
                    return report
                raise RuntimeError(f"refusing to overwrite sealed pack at {DEST}")
            SEALED_ROOT.mkdir(parents=True, exist_ok=True)
            shutil.copytree(a, DEST)
            # Mark destination read-only at OS level where possible (best-effort)
            for p in DEST.glob("*.json"):
                try:
                    os.chmod(p, 0o444)
                except OSError:
                    pass
            report["promoted"] = True
            report["seal_v2"] = ra["manifest"].get("seal_v2")
            report["dest_manifest_raw_sha256"] = sha256_file(DEST / "manifest.json")
        return report


def main() -> int:
    out = build_pack(promote=True)
    print(json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
