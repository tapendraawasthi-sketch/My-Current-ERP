"""Build the immutable R3N6 evidence-chain corrective candidate pack.

Resource bytes intentionally match R3N5 because R3N6 corrects scorer
independence and output binding, not language resources or ranking behavior.
The pack identity is nevertheless new so the consumed R3N5 attempt is never
repaired or rerun in place.
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
from pathlib import Path

from ..infrastructure.seal_contract_v2 import (
    RESOURCE_HASH_ALGORITHM,
    RESOURCE_HASH_DOMAIN,
    SEAL_CONTRACT_VERSION,
    build_resource_seal_fields,
    resource_content_sha256,
    resource_file_hashes,
    semantic_json_hash,
    sha256_bytes,
    sha256_file,
)
from .build_mai07r3n4_pack import ALLOWED_FILES

REPO = Path(__file__).resolve().parents[7]
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
SOURCE_PACK_VERSION = "mai-07.1.10-r3n5-targetspan"
PACK_VERSION = "mai-07.1.11-r3n6-chaincomplete"
SOURCE = XL / "sealed_packs" / SOURCE_PACK_VERSION
DEST = XL / "sealed_packs" / PACK_VERSION
AUTHORIZE_ENV = "MAI07_AUTHORIZE_R3N6_PACK_PROMOTE"
SOURCE_RESOURCE_ID = "mai07_transliteration_pack_r3n5_target_span"
PACK_RESOURCE_ID = "mai07_transliteration_pack_r3n6_chain_complete"
EXPECTED_SOURCE_CONTENT_HASH = (
    "8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106"
)
EXPECTED_SOURCE_MANIFEST_RAW_SHA256 = (
    "c3427c17b0beeb38c336a7d3b7cb607f4f1a06ced3953f60cff48e7544a61d38"
)
SOURCE_PROVENANCE = (
    "MAI-07R3N5 isolated candidate derived byte-for-byte from failed R3N4 "
    "resources; correction scope is target-span/evaluation-path authority; "
    "no lexicon, ranking, or target spelling change; active R3F unchanged."
)
PACK_PROVENANCE = (
    "MAI-07R3N6 isolated candidate derived byte-for-byte from invalidated "
    "R3N5 resources; correction scope is complete independent scoring and "
    "attempt-time output binding; no lexicon, ranking, target spelling, or "
    "runtime behavior change; active R3F unchanged."
)
EXPECTED_ENTRY_NAMES = frozenset(["manifest.json", *ALLOWED_FILES])


def _json_bytes(value: dict) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode("utf-8")


def _write_json(path: Path, value: dict) -> None:
    path.write_bytes(_json_bytes(value))


def _entry_names(directory: Path) -> set[str]:
    return {entry.name for entry in directory.iterdir()}


def _file_set_errors(directory: Path) -> list[str]:
    if not directory.is_dir():
        return ["directory_missing"]
    actual = _entry_names(directory)
    missing = sorted(EXPECTED_ENTRY_NAMES - actual)
    extra = sorted(actual - EXPECTED_ENTRY_NAMES)
    errors: list[str] = []
    if missing or extra:
        errors.append(
            "file_set_mismatch:"
            f"missing={','.join(missing) or '-'}:"
            f"extra={','.join(extra) or '-'}"
        )
    for name in sorted(EXPECTED_ENTRY_NAMES & actual):
        path = directory / name
        if not path.is_file() or path.is_symlink():
            errors.append(f"entry_not_regular_file:{name}")
    return errors


def _expected_seal(directory: Path, manifest_without_seal: dict) -> dict:
    return {
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "resource_content_sha256": resource_content_sha256(
            resources_dir=directory, file_names=list(ALLOWED_FILES)
        ),
        "resource_manifest_raw_sha256": sha256_bytes(
            _json_bytes(manifest_without_seal)
        ),
        "resource_manifest_semantic_sha256": semantic_json_hash(
            manifest_without_seal
        ),
        "resource_file_count": len(ALLOWED_FILES),
        "resource_file_hashes": resource_file_hashes(
            resources_dir=directory, file_names=list(ALLOWED_FILES)
        ),
        "resource_hash_algorithm": RESOURCE_HASH_ALGORITHM,
        "resource_hash_domain": RESOURCE_HASH_DOMAIN,
    }


def _validate_pack(
    directory: Path,
    *,
    expected_pack_version: str,
    expected_resource_id: str,
    expected_provenance: str,
    expected_content_hash: str,
    expected_manifest_raw_sha256: str | None = None,
) -> tuple[dict | None, str | None, list[str]]:
    errors = _file_set_errors(directory)
    manifest_path = directory / "manifest.json"
    if not manifest_path.is_file() or manifest_path.is_symlink():
        return None, None, errors

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        errors.append(f"manifest_unreadable:{type(exc).__name__}")
        return None, None, errors
    if not isinstance(manifest, dict):
        errors.append("manifest_not_object")
        return None, None, errors
    if manifest_path.read_bytes() != _json_bytes(manifest):
        errors.append("manifest_serialization_mismatch")
    if (
        expected_manifest_raw_sha256 is not None
        and sha256_file(manifest_path) != expected_manifest_raw_sha256
    ):
        errors.append("manifest_raw_sha256_mismatch")
    if manifest.get("resource_pack_version") != expected_pack_version:
        errors.append("pack_version_mismatch")
    if manifest.get("resource_id") != expected_resource_id:
        errors.append("resource_id_mismatch")
    if manifest.get("provenance") != expected_provenance:
        errors.append("provenance_mismatch")
    if manifest.get("default_active") is not False:
        errors.append("default_active_must_be_false")
    if manifest.get("seal_contract_version") != SEAL_CONTRACT_VERSION:
        errors.append("seal_contract_version_mismatch")
    if manifest.get("files") != list(ALLOWED_FILES):
        errors.append("manifest_file_set_mismatch")

    resources_are_regular = all(
        (directory / name).is_file() and not (directory / name).is_symlink()
        for name in ALLOWED_FILES
    )
    computed: str | None = None
    if resources_are_regular:
        computed = resource_content_sha256(
            resources_dir=directory, file_names=list(ALLOWED_FILES)
        )
        if computed != expected_content_hash:
            errors.append("expected_content_hash_mismatch")
        if manifest.get("content_hash") != computed:
            errors.append("content_hash_mismatch")

        seal = manifest.get("seal_v2")
        if not isinstance(seal, dict):
            errors.append("seal_v2_missing_or_invalid")
        else:
            manifest_without_seal = dict(manifest)
            manifest_without_seal.pop("seal_v2", None)
            if seal != _expected_seal(directory, manifest_without_seal):
                errors.append("seal_v2_mismatch")
    elif "seal_v2_missing_or_invalid" not in errors:
        errors.append("resource_files_unavailable_for_seal_validation")
    return manifest, computed, errors


def _validate_parent() -> tuple[dict | None, str | None, list[str]]:
    return _validate_pack(
        SOURCE,
        expected_pack_version=SOURCE_PACK_VERSION,
        expected_resource_id=SOURCE_RESOURCE_ID,
        expected_provenance=SOURCE_PROVENANCE,
        expected_content_hash=EXPECTED_SOURCE_CONTENT_HASH,
        expected_manifest_raw_sha256=EXPECTED_SOURCE_MANIFEST_RAW_SHA256,
    )


def _require_valid_parent() -> dict:
    manifest, _computed, errors = _validate_parent()
    if errors or manifest is None:
        raise RuntimeError("invalid_r3n5_parent:" + "|".join(errors))
    return manifest


def _candidate_manifest(parent_manifest: dict, content_hash: str) -> dict:
    manifest = dict(parent_manifest)
    manifest.pop("seal_v2", None)
    manifest.update(
        {
            "resource_id": PACK_RESOURCE_ID,
            "resource_pack_version": PACK_VERSION,
            "content_hash": content_hash,
            "update_date": "2026-07-18",
            "default_active": False,
            "seal_contract_version": SEAL_CONTRACT_VERSION,
            "provenance": PACK_PROVENANCE,
        }
    )
    return manifest


def _materialize(destination: Path) -> dict:
    parent_manifest = _require_valid_parent()
    destination.mkdir(parents=True, exist_ok=True)
    if any(destination.iterdir()):
        raise RuntimeError("r3n6_materialization_destination_not_empty")
    for name in ALLOWED_FILES:
        source = SOURCE / name
        shutil.copy2(source, destination / name)
    content_hash = resource_content_sha256(
        resources_dir=destination, file_names=list(ALLOWED_FILES)
    )
    if content_hash != EXPECTED_SOURCE_CONTENT_HASH:
        raise RuntimeError("r3n6_materialized_content_differs_from_parent")
    for name in ALLOWED_FILES:
        if (destination / name).read_bytes() != (SOURCE / name).read_bytes():
            raise RuntimeError(f"r3n6_materialized_byte_mismatch:{name}")

    manifest = _candidate_manifest(parent_manifest, content_hash)
    _write_json(destination / "manifest.json", manifest)
    manifest["seal_v2"] = build_resource_seal_fields(
        resources_dir=destination, manifest=manifest
    )
    _write_json(destination / "manifest.json", manifest)

    validated, computed, errors = _validate_pack(
        destination,
        expected_pack_version=PACK_VERSION,
        expected_resource_id=PACK_RESOURCE_ID,
        expected_provenance=PACK_PROVENANCE,
        expected_content_hash=EXPECTED_SOURCE_CONTENT_HASH,
    )
    if errors or validated is None or computed != content_hash:
        raise RuntimeError("invalid_materialized_r3n6_pack:" + "|".join(errors))
    validated_without_seal = dict(validated)
    validated_without_seal.pop("seal_v2", None)
    if validated_without_seal != _candidate_manifest(parent_manifest, content_hash):
        raise RuntimeError("r3n6_manifest_not_exact_parent_derivation")
    return {
        "content_hash": content_hash,
        "manifest": manifest,
        "present_files": list(ALLOWED_FILES),
        "manifest_raw_sha256": sha256_file(destination / "manifest.json"),
    }


def check_twice() -> dict:
    with tempfile.TemporaryDirectory(
        prefix="mai07_r3n6_a_"
    ) as first_dir, tempfile.TemporaryDirectory(
        prefix="mai07_r3n6_b_"
    ) as second_dir:
        first = Path(first_dir)
        second = Path(second_dir)
        a = _materialize(first)
        b = _materialize(second)
        names = ["manifest.json", *a["present_files"]]
        if a["content_hash"] != b["content_hash"] or any(
            (first / name).read_bytes() != (second / name).read_bytes()
            for name in names
        ):
            raise RuntimeError("r3n6_dual_build_mismatch")
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
    parent_manifest, parent_computed, parent_errors = _validate_parent()
    manifest, computed, errors = _validate_pack(
        DEST,
        expected_pack_version=PACK_VERSION,
        expected_resource_id=PACK_RESOURCE_ID,
        expected_provenance=PACK_PROVENANCE,
        expected_content_hash=EXPECTED_SOURCE_CONTENT_HASH,
    )
    errors = [*(f"parent:{error}" for error in parent_errors), *errors]
    if parent_manifest is not None and manifest is not None and computed is not None:
        manifest_without_seal = dict(manifest)
        manifest_without_seal.pop("seal_v2", None)
        if manifest_without_seal != _candidate_manifest(parent_manifest, computed):
            errors.append("candidate_manifest_not_exact_parent_derivation")
    if parent_computed is not None and computed is not None and computed != parent_computed:
        errors.append("parent_content_hash_mismatch")
    if SOURCE.is_dir() and DEST.is_dir():
        for name in ALLOWED_FILES:
            parent_path = SOURCE / name
            candidate_path = DEST / name
            if (
                parent_path.is_file()
                and candidate_path.is_file()
                and parent_path.read_bytes() != candidate_path.read_bytes()
            ):
                errors.append(f"parent_resource_byte_mismatch:{name}")
    return {
        "ok": not errors,
        "errors": errors,
        "content_hash": computed,
        "pack_version": PACK_VERSION,
    }


def build_pack() -> dict:
    dual = check_twice()
    if DEST.exists():
        existing = check_existing()
        if existing["ok"] and existing["content_hash"] == dual["content_hash"]:
            return {**dual, "already_sealed": True, "promoted": False}
        raise RuntimeError("refusing_to_overwrite_r3n6_sealed_pack")
    if os.environ.get(AUTHORIZE_ENV) != "1":
        raise PermissionError(f"Set {AUTHORIZE_ENV}=1 to create the R3N6 sealed pack")
    with tempfile.TemporaryDirectory(prefix="mai07_r3n6_promote_") as temporary:
        source = Path(temporary)
        _materialize(source)
        shutil.copytree(source, DEST)
    return {
        **dual,
        "promoted": True,
        "manifest_raw_sha256": sha256_file(DEST / "manifest.json"),
    }


__all__ = [
    "PACK_VERSION",
    "SOURCE_PACK_VERSION",
    "DEST",
    "build_pack",
    "check_existing",
    "check_twice",
]
