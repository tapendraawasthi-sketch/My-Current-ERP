"""MAI-07 artifact seal contract v2.0.0 — unambiguous hash field definitions.

Contract id: mai-07-artifact-seal-contract.2.0.0

Every SHA field has a single meaning. Do not overload predictions_sha256.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

SEAL_CONTRACT_VERSION = "mai-07-artifact-seal-contract.2.0.0"
SEAL_CONTRACT_SCHEMA = "2.0.0"
RESOURCE_HASH_ALGORITHM = "SHA-256"
RESOURCE_HASH_DOMAIN = "mai07.resource_pack.v1_files_nul_raw"
PREDICTION_ORDERING = "sorted_by_case_id_ascending"
CANONICAL_SERIALIZATION = "json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(',', ':'))"
REPORT_SERIALIZATION = "json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + '\\n' (LF)"

# Known vectors for fixed-byte tests (contract self-check).
KNOWN_VECTOR_EMPTY = hashlib.sha256(b"").hexdigest()
KNOWN_VECTOR_ABC = hashlib.sha256(b"abc").hexdigest()
KNOWN_VECTOR_CANONICAL_EMPTY_LIST = hashlib.sha256(
    json.dumps([], ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
).hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def canonical_json(obj: Any) -> str:
    """Canonical serialization contract (no spaces; sorted keys; UTF-8)."""
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def semantic_json_hash(obj: Any) -> str:
    """Semantic hash = SHA-256 of canonical_json UTF-8 bytes."""
    return sha256_bytes(canonical_json(obj).encode("utf-8"))


def pretty_report_bytes(obj: Any) -> bytes:
    return (json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def resource_content_sha256(
    *,
    resources_dir: Path,
    file_names: list[str],
) -> str:
    """resource_content_sha256 / resource_hash_domain.

    Input: for each name in sorted(file_names): name.encode('utf-8') + NUL + raw file bytes.
    Excludes manifest.json. No newline normalization. Encoding: as stored on disk.
    Producer/validator: compute_pack_content_hash / validate_resources.
    """
    h = hashlib.sha256()
    for name in sorted(str(x) for x in file_names):
        h.update(name.encode("utf-8"))
        h.update(b"\0")
        h.update((resources_dir / name).read_bytes())
    return h.hexdigest()


def resource_file_hashes(*, resources_dir: Path, file_names: list[str]) -> dict[str, str]:
    return {name: sha256_file(resources_dir / name) for name in sorted(str(x) for x in file_names)}


def resource_manifest_raw_sha256(manifest_path: Path) -> str:
    """Raw bytes of sealed manifest.json on disk (LF or CRLF as stored)."""
    return sha256_file(manifest_path)


def resource_manifest_semantic_sha256(manifest: dict[str, Any]) -> str:
    """SHA-256 of canonical_json(manifest) — key-order independent."""
    return semantic_json_hash(manifest)


def runtime_source_sha256(paths: list[Path]) -> str:
    """Sorted by filename: name + NUL + raw bytes."""
    h = hashlib.sha256()
    for p in sorted(paths, key=lambda x: x.name):
        h.update(p.name.encode("utf-8"))
        h.update(b"\0")
        h.update(p.read_bytes())
    return h.hexdigest()


def predictions_jsonl_raw_sha256(path: Path) -> str:
    """Raw JSONL file bytes."""
    return sha256_file(path)


def predictions_canonical_list_sha256(preds: list[dict[str, Any]]) -> str:
    """SHA-256 of canonical_json(list) — producer list digest (NOT raw JSONL)."""
    ordered = sorted(preds, key=lambda p: p["case_id"])
    return semantic_json_hash(ordered)


def predictions_semantic_sha256(preds: list[dict[str, Any]]) -> str:
    """Alias of predictions_canonical_list_sha256 under this contract (same object)."""
    return predictions_canonical_list_sha256(preds)


def report_raw_and_semantic(path: Path | None = None, obj: dict[str, Any] | None = None) -> tuple[str, str]:
    if path is not None:
        raw = sha256_file(path)
        obj = json.loads(path.read_text(encoding="utf-8"))
    else:
        assert obj is not None
        raw = sha256_bytes(pretty_report_bytes(obj))
    return raw, semantic_json_hash(obj)


def build_resource_seal_fields(*, resources_dir: Path, manifest: dict[str, Any]) -> dict[str, Any]:
    files = list(manifest.get("files", []))
    content = resource_content_sha256(resources_dir=resources_dir, file_names=files)
    man_path = resources_dir / "manifest.json"
    return {
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "resource_content_sha256": content,
        "resource_manifest_raw_sha256": resource_manifest_raw_sha256(man_path) if man_path.exists() else None,
        "resource_manifest_semantic_sha256": resource_manifest_semantic_sha256(manifest),
        "resource_file_count": len(files),
        "resource_file_hashes": resource_file_hashes(resources_dir=resources_dir, file_names=files),
        "resource_hash_algorithm": RESOURCE_HASH_ALGORITHM,
        "resource_hash_domain": RESOURCE_HASH_DOMAIN,
    }


def contract_metadata() -> dict[str, Any]:
    return {
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "seal_contract_schema": SEAL_CONTRACT_SCHEMA,
        "resource_hash_algorithm": RESOURCE_HASH_ALGORITHM,
        "resource_hash_domain": RESOURCE_HASH_DOMAIN,
        "prediction_ordering_contract": PREDICTION_ORDERING,
        "canonical_serialization_contract": CANONICAL_SERIALIZATION,
        "report_serialization_contract": REPORT_SERIALIZATION,
        "known_vectors": {
            "sha256_empty": KNOWN_VECTOR_EMPTY,
            "sha256_abc": KNOWN_VECTOR_ABC,
            "canonical_empty_list": KNOWN_VECTOR_CANONICAL_EMPTY_LIST,
        },
        "field_catalogue": {
            "resource_content_sha256": "sorted filename+NUL+raw file bytes; excludes manifest.json",
            "resource_manifest_raw_sha256": "raw manifest.json file bytes",
            "resource_manifest_semantic_sha256": "canonical_json(manifest object)",
            "runtime_source_sha256": "sorted source filenames + NUL + raw bytes",
            "runtime_config_sha256": "raw guard/config file bytes (single file or concatenated per builder)",
            "runtime_semantic_sha256": "alias of code_semantic_hash over decision-logic sources",
            "predictions_jsonl_raw_sha256": "raw JSONL file bytes",
            "predictions_canonical_list_sha256": "canonical_json(sorted prediction list)",
            "predictions_semantic_sha256": "same as predictions_canonical_list_sha256",
            "canonical_report_raw_sha256": "pretty-printed report file raw bytes",
            "canonical_report_semantic_sha256": "canonical_json(report object)",
            "audit_report_raw_sha256": "pretty-printed audit file raw bytes",
            "audit_report_semantic_sha256": "canonical_json(audit object)",
            "rc_manifest_raw_sha256": "pretty-printed RC manifest file raw bytes",
            "rc_manifest_semantic_sha256": "canonical_json(RC object)",
        },
    }
