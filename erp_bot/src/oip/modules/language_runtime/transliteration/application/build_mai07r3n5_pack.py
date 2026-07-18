"""Build the immutable R3N5 target-span candidate pack.

Resource bytes intentionally match the failed R3N4 parent because R3N5 corrects
evaluation target/path authority, not language resources. The manifest and pack
version are new; the active default remains R3F.
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
from pathlib import Path

from ..infrastructure.seal_contract_v2 import (
    SEAL_CONTRACT_VERSION,
    build_resource_seal_fields,
    resource_content_sha256,
    sha256_file,
)
from .build_mai07r3n4_pack import ALLOWED_FILES

REPO = Path(__file__).resolve().parents[7]
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
SOURCE_PACK_VERSION = "mai-07.1.9-r3n4-identityanchor"
PACK_VERSION = "mai-07.1.10-r3n5-targetspan"
SOURCE = XL / "sealed_packs" / SOURCE_PACK_VERSION
DEST = XL / "sealed_packs" / PACK_VERSION
AUTHORIZE_ENV = "MAI07_AUTHORIZE_R3N5_PACK_PROMOTE"


def _write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def _materialize(destination: Path) -> dict:
    destination.mkdir(parents=True, exist_ok=True)
    present: list[str] = []
    for name in ALLOWED_FILES:
        source = SOURCE / name
        if not source.is_file():
            continue
        shutil.copy2(source, destination / name)
        present.append(name)
    content_hash = resource_content_sha256(resources_dir=destination, file_names=present)
    parent_manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    manifest = dict(parent_manifest)
    manifest.update(
        {
            "resource_id": "mai07_transliteration_pack_r3n5_target_span",
            "resource_pack_version": PACK_VERSION,
            "content_hash": content_hash,
            "update_date": "2026-07-18",
            "default_active": False,
            "seal_contract_version": SEAL_CONTRACT_VERSION,
            "provenance": (
                "MAI-07R3N5 isolated candidate derived byte-for-byte from failed R3N4 resources; "
                "correction scope is target-span/evaluation-path authority; no lexicon, ranking, "
                "or target spelling change; active R3F unchanged."
            ),
        }
    )
    manifest.pop("seal_v2", None)
    _write_json(destination / "manifest.json", manifest)
    manifest["seal_v2"] = build_resource_seal_fields(resources_dir=destination, manifest=manifest)
    _write_json(destination / "manifest.json", manifest)
    return {
        "content_hash": content_hash,
        "manifest": manifest,
        "present_files": present,
        "manifest_raw_sha256": sha256_file(destination / "manifest.json"),
    }


def check_twice() -> dict:
    with tempfile.TemporaryDirectory(prefix="mai07_r3n5_a_") as first_dir, tempfile.TemporaryDirectory(
        prefix="mai07_r3n5_b_"
    ) as second_dir:
        first = Path(first_dir)
        second = Path(second_dir)
        a = _materialize(first)
        b = _materialize(second)
        names = ["manifest.json", *a["present_files"]]
        if a["content_hash"] != b["content_hash"] or any(
            (first / name).read_bytes() != (second / name).read_bytes() for name in names
        ):
            raise RuntimeError("r3n5_dual_build_mismatch")
        return {
            "ok": True,
            "pack_version": PACK_VERSION,
            "content_hash": a["content_hash"],
            "dual_build_identical": True,
            "default_active": False,
        }


def check_existing() -> dict:
    if not DEST.is_dir():
        return {"ok": False, "error": "dest_not_sealed"}
    manifest = json.loads((DEST / "manifest.json").read_text(encoding="utf-8"))
    present = [name for name in ALLOWED_FILES if (DEST / name).is_file()]
    computed = resource_content_sha256(resources_dir=DEST, file_names=present)
    errors = []
    if manifest.get("resource_pack_version") != PACK_VERSION:
        errors.append("pack_version_mismatch")
    if manifest.get("content_hash") != computed:
        errors.append("content_hash_mismatch")
    if manifest.get("default_active") is not False:
        errors.append("default_active_must_be_false")
    return {"ok": not errors, "errors": errors, "content_hash": computed, "pack_version": PACK_VERSION}


def build_pack() -> dict:
    dual = check_twice()
    if DEST.exists():
        existing = check_existing()
        if existing["ok"] and existing["content_hash"] == dual["content_hash"]:
            return {**dual, "already_sealed": True, "promoted": False}
        raise RuntimeError("refusing_to_overwrite_r3n5_sealed_pack")
    if os.environ.get(AUTHORIZE_ENV) != "1":
        raise PermissionError(f"Set {AUTHORIZE_ENV}=1 to create the R3N5 sealed pack")
    with tempfile.TemporaryDirectory(prefix="mai07_r3n5_promote_") as temporary:
        source = Path(temporary)
        _materialize(source)
        shutil.copytree(source, DEST)
    return {**dual, "promoted": True, "manifest_raw_sha256": sha256_file(DEST / "manifest.json")}


__all__ = ["PACK_VERSION", "SOURCE_PACK_VERSION", "DEST", "build_pack", "check_existing", "check_twice"]
