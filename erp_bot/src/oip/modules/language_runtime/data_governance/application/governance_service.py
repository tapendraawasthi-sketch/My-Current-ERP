"""MAI-12 language data catalog scanner and training-eligibility gates."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from .....contracts.language_data_governance import (
    AssetPresence,
    LanguageDataAssetV1,
    LanguageDataCatalogV1,
    LanguageDataGovernanceStatus,
    LanguageDataRole,
)
from .. import CATALOG_VERSION, RUNTIME_VERSION

_REGISTRY = (
    Path(__file__).resolve().parent.parent / "resources" / "language_data_registry_v1.json"
)


def find_repo_root(start: Path | None = None) -> Path:
    cur = (start or Path(__file__).resolve()).parent
    for _ in range(12):
        if (cur / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").is_file():
            return cur
        if cur.parent == cur:
            break
        cur = cur.parent
    # Fallback: .../erp_bot/src/oip/modules/language_runtime/data_governance/application
    return Path(__file__).resolve().parents[7]


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def load_registry() -> dict[str, Any]:
    return json.loads(_REGISTRY.read_text(encoding="utf-8"))


def _manifest_file_hashes(manifest_path: Path) -> dict[str, str]:
    """Map relative path → expected sha256 from a MAI_* manifest.json."""
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for entry in data.get("files") or []:
        rel = str(entry.get("path") or "").replace("\\", "/")
        digest = entry.get("sha256")
        if rel and digest:
            out[rel] = str(digest)
    return out


def scan_prohibited_for_training(
    repo_root: Path,
    globs: list[str],
) -> tuple[int, list[str]]:
    """Return (violation_count, sample error codes)."""
    violations = 0
    errors: list[str] = []
    for pattern in globs:
        for path in sorted(repo_root.glob(pattern)):
            if not path.is_file():
                continue
            for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    violations += 1
                    errors.append(f"JSONL_PARSE:{path.name}:{i}")
                    continue
                if row.get("prohibited_for_training") is not True:
                    violations += 1
                    if len(errors) < 20:
                        errors.append(f"TRAINING_FLAG:{path.as_posix()}:{i}")
    return violations, errors


def build_language_data_catalog(
    *,
    repo_root: Path | None = None,
) -> LanguageDataCatalogV1:
    root = repo_root or find_repo_root()
    reg = load_registry()
    assets: list[LanguageDataAssetV1] = []
    warnings: list[str] = []
    error_codes: list[str] = []
    hash_mismatches = 0
    missing_required = 0

    for spec in reg.get("assets") or []:
        rel = str(spec["path"]).replace("\\", "/")
        path = root / rel
        role = LanguageDataRole(spec["role"])
        training_eligible = bool(spec.get("training_eligible", False))
        required = bool(spec.get("required", False))
        expected = spec.get("expected_sha256")
        presence = AssetPresence.MISSING
        digest: str | None = None

        if path.is_file():
            digest = _sha256_file(path)
            presence = AssetPresence.PRESENT
            if expected and digest != expected:
                presence = AssetPresence.HASH_MISMATCH
                hash_mismatches += 1
                error_codes.append(f"HASH_MISMATCH:{spec['asset_id']}")
            # For manifests, also verify listed frozen file hashes.
            if rel.endswith(".manifest.json") and role is LanguageDataRole.FROZEN_EVAL:
                try:
                    for child_rel, child_hash in _manifest_file_hashes(path).items():
                        child = root / child_rel
                        if not child.is_file():
                            hash_mismatches += 1
                            error_codes.append(f"MANIFEST_CHILD_MISSING:{child_rel}")
                            continue
                        actual = _sha256_file(child)
                        if actual != child_hash:
                            hash_mismatches += 1
                            error_codes.append(f"MANIFEST_CHILD_HASH:{child_rel}")
                except Exception as exc:  # noqa: BLE001
                    error_codes.append(f"MANIFEST_PARSE:{spec['asset_id']}:{type(exc).__name__}")
        elif path.is_dir():
            # Directory assets (e.g. processed/jsonl) — presence only, no sha256.
            presence = AssetPresence.PRESENT
        elif required:
            missing_required += 1
            error_codes.append(f"MISSING_REQUIRED:{spec['asset_id']}")
        else:
            warnings.append(f"OPTIONAL_MISSING:{spec['asset_id']}")

        assets.append(
            LanguageDataAssetV1(
                asset_id=str(spec["asset_id"]),
                path=rel,
                role=role,
                training_eligible=training_eligible,
                presence=presence,
                sha256=digest,
                expected_sha256=str(expected) if expected else None,
                notes=spec.get("notes"),
            )
        )

    frozen_violations, freeze_errors = scan_prohibited_for_training(
        root, list(reg.get("frozen_jsonl_globs") or [])
    )
    error_codes.extend(freeze_errors)

    # MAI-12 slice 2: attach KB rebuildability (GAP-P2-005).
    from .rebuildability_service import assess_kb_rebuildability

    rebuild = assess_kb_rebuildability(repo_root=root)
    warnings.extend(list(rebuild.warnings))
    error_codes.extend(list(rebuild.error_codes))

    status = LanguageDataGovernanceStatus.COMPLETE
    if error_codes or hash_mismatches or missing_required or frozen_violations:
        status = (
            LanguageDataGovernanceStatus.FAILED
            if (missing_required or frozen_violations or hash_mismatches)
            else LanguageDataGovernanceStatus.PARTIAL
        )
    if rebuild.analysis_status is LanguageDataGovernanceStatus.FAILED:
        status = LanguageDataGovernanceStatus.FAILED

    return LanguageDataCatalogV1(
        analysis_status=status,
        runtime_version=RUNTIME_VERSION,
        catalog_version=str(reg.get("catalog_version") or CATALOG_VERSION),
        assets=tuple(assets),
        warnings=tuple(dict.fromkeys(warnings)),
        error_codes=tuple(dict.fromkeys(error_codes)),
        frozen_training_violations=frozen_violations,
        hash_mismatches=hash_mismatches,
        missing_required=missing_required,
        kb_rebuildability=rebuild,
    )


def assert_catalog_training_safe(catalog: LanguageDataCatalogV1) -> None:
    """Fail closed if any frozen asset is training-eligible or JSONL flags leak."""
    for asset in catalog.assets:
        if asset.role is LanguageDataRole.FROZEN_EVAL and asset.training_eligible:
            raise AssertionError(f"FROZEN_TRAINING_ELIGIBLE:{asset.asset_id}")
    if catalog.frozen_training_violations:
        raise AssertionError(
            f"FROZEN_JSONL_TRAINING_FLAG_VIOLATIONS:{catalog.frozen_training_violations}"
        )
    if catalog.hash_mismatches:
        raise AssertionError(f"HASH_MISMATCHES:{catalog.hash_mismatches}")
    if catalog.missing_required:
        raise AssertionError(f"MISSING_REQUIRED:{catalog.missing_required}")
