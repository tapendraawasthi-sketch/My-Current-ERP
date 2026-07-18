"""Compact language resource repository — load once, cache process-wide."""

from __future__ import annotations

import hashlib
import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_LOCK = threading.Lock()
_CACHE: CompactResources | None = None
_LOAD_MS: float | None = None

RESOURCES_DIR = Path(__file__).resolve().parent.parent / "resources"

_FORBIDDEN_SUBSTR = (
    "mai04_",
    "mai05_",
    "expected_language_form",
    "prohibited_for_training",
)


@dataclass(frozen=True)
class CompactResources:
    manifest: dict[str, Any]
    romanized: frozenset[str]
    english_accounting: frozenset[str]
    ambiguous_latin: frozenset[str]
    named_entity_candidates: frozenset[str]
    protected_prefixes: tuple[str, ...]
    version: str
    content_hash: str


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def compute_pack_content_hash(manifest: dict[str, Any] | None = None) -> str:
    """SHA-256 over lexicographically sorted lexicon file bytes named in the manifest."""
    man = manifest or _read_json(RESOURCES_DIR / "manifest.json")
    h = hashlib.sha256()
    for name in sorted(str(x) for x in man.get("files", [])):
        h.update(name.encode("utf-8"))
        h.update(b"\0")
        h.update((RESOURCES_DIR / name).read_bytes())
    return h.hexdigest()


def seal_manifest_hash() -> str:
    """Write computed pack hash into manifest.json; return hash."""
    path = RESOURCES_DIR / "manifest.json"
    man = _read_json(path)
    digest = compute_pack_content_hash(man)
    man["content_hash"] = digest
    path.write_text(json.dumps(man, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return digest


def validate_resources(*, fix_hash: bool = False) -> dict[str, Any]:
    """Deterministic resource checks: schema fields, duplicates, hash, no eval leakage."""
    man = _read_json(RESOURCES_DIR / "manifest.json")
    errors: list[str] = []
    warnings: list[str] = []
    for key in (
        "resource_id",
        "resource_pack_version",
        "schema_version",
        "content_hash",
        "files",
        "allowed_use",
        "license_status",
        "review_status",
        "provenance",
        "update_date",
    ):
        if key not in man:
            errors.append(f"missing_manifest_field:{key}")
    entry_counts: dict[str, int] = {}
    seen_global: dict[str, str] = {}
    for name in man.get("files", []):
        data = _read_json(RESOURCES_DIR / str(name))
        entries = data.get("entries", [])
        entry_counts[str(name)] = len(entries)
        local: set[str] = set()
        for e in entries:
            s = str(e).strip().lower()
            if not s:
                errors.append(f"empty_entry:{name}")
                continue
            if s in local:
                errors.append(f"duplicate_in_file:{name}:{s}")
            local.add(s)
            if s in seen_global and seen_global[s] != name:
                if ("romanized" in name and "english" in seen_global[s]) or (
                    "english" in name and "romanized" in seen_global[s]
                ):
                    errors.append(f"conflicting_lexicon:{s}:{seen_global[s]}~{name}")
                else:
                    warnings.append(f"cross_file_overlap:{s}:{seen_global[s]}~{name}")
            else:
                seen_global[s] = str(name)
            for bad in _FORBIDDEN_SUBSTR:
                if bad in s:
                    errors.append(f"eval_leakage_token:{name}:{bad}")
            blob = json.dumps(data, ensure_ascii=False)
            for bad in _FORBIDDEN_SUBSTR:
                if bad in blob:
                    errors.append(f"eval_leakage_file:{name}:{bad}")
                    break
    computed = compute_pack_content_hash(man)
    stored = str(man.get("content_hash", ""))
    if fix_hash and computed != stored:
        stored = seal_manifest_hash()
        computed = stored
    if computed != stored:
        errors.append(f"content_hash_mismatch:stored={stored}:computed={computed}")
    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "content_hash": computed,
        "entry_counts": entry_counts,
        "resource_pack_version": man.get("resource_pack_version"),
        "resource_id": man.get("resource_id"),
    }


def load_resources(*, force_reload: bool = False) -> CompactResources:
    global _CACHE, _LOAD_MS
    with _LOCK:
        if _CACHE is not None and not force_reload:
            return _CACHE
        import time

        t0 = time.perf_counter()
        manifest = _read_json(RESOURCES_DIR / "manifest.json")
        romanized = frozenset(
            str(x).lower() for x in _read_json(RESOURCES_DIR / "high_confidence_romanized_nepali.json")["entries"]
        )
        english = frozenset(
            str(x).lower() for x in _read_json(RESOURCES_DIR / "high_confidence_english_accounting.json")["entries"]
        )
        ambiguous = frozenset(
            str(x).lower() for x in _read_json(RESOURCES_DIR / "ambiguous_latin.json")["entries"]
        )
        names = frozenset(
            str(x).lower() for x in _read_json(RESOURCES_DIR / "named_entity_candidates.json")["entries"]
        )
        prefixes = tuple(_read_json(RESOURCES_DIR / "protected_prefixes.json")["entries"])
        res = CompactResources(
            manifest=manifest,
            romanized=romanized,
            english_accounting=english,
            ambiguous_latin=ambiguous,
            named_entity_candidates=names,
            protected_prefixes=prefixes,
            version=str(manifest.get("resource_pack_version", "mai-05.1.0")),
            content_hash=str(manifest.get("content_hash", "")),
        )
        _LOAD_MS = (time.perf_counter() - t0) * 1000
        _CACHE = res
        return res


def last_load_ms() -> float | None:
    return _LOAD_MS


def main() -> None:
    import argparse
    import sys

    p = argparse.ArgumentParser(description="Validate MAI-05 compact language resources")
    p.add_argument("--seal", action="store_true", help="Rewrite manifest content_hash")
    p.add_argument("--check-twice", action="store_true", help="Seal twice and report second-run no-diff")
    args = p.parse_args()
    if args.check_twice:
        seal_manifest_hash()
        before = (RESOURCES_DIR / "manifest.json").read_bytes()
        seal_manifest_hash()
        after = (RESOURCES_DIR / "manifest.json").read_bytes()
        report = validate_resources()
        report["second_run_no_diff"] = before == after
        print(json.dumps(report, indent=2, sort_keys=True))
        sys.exit(0 if report["ok"] and report["second_run_no_diff"] else 1)
    if args.seal:
        seal_manifest_hash()
    report = validate_resources()
    print(json.dumps(report, indent=2, sort_keys=True))
    sys.exit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
