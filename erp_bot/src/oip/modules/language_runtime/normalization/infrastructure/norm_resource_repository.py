"""Compact MAI-06 normalization resource pack — load once."""

from __future__ import annotations

import hashlib
import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_LOCK = threading.Lock()
_CACHE: CompactNormResources | None = None
_LOAD_MS: float | None = None

RESOURCES_DIR = Path(__file__).resolve().parent.parent / "resources"

_FORBIDDEN = ("mai04_", "mai05_", "mai06_", "expected_view", "prohibited_for_training")


@dataclass(frozen=True)
class CompactNormResources:
    manifest: dict[str, Any]
    whitespace_map: dict[str, str]
    digit_map: dict[str, str]
    punctuation_candidates: dict[str, list[str]]
    abbreviations: dict[str, list[str]]
    repetition_min_run: int
    security_categories: dict[str, list[str]]
    version: str
    content_hash: str


def _read(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def compute_pack_content_hash(manifest: dict[str, Any] | None = None) -> str:
    man = manifest or _read(RESOURCES_DIR / "manifest.json")
    h = hashlib.sha256()
    for name in sorted(str(x) for x in man.get("files", [])):
        h.update(name.encode("utf-8"))
        h.update(b"\0")
        h.update((RESOURCES_DIR / name).read_bytes())
    return h.hexdigest()


def seal_manifest_hash() -> str:
    path = RESOURCES_DIR / "manifest.json"
    man = _read(path)
    digest = compute_pack_content_hash(man)
    man["content_hash"] = digest
    path.write_text(json.dumps(man, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return digest


def validate_resources() -> dict[str, Any]:
    man = _read(RESOURCES_DIR / "manifest.json")
    errors: list[str] = []
    for key in (
        "resource_id",
        "resource_pack_version",
        "schema_version",
        "content_hash",
        "files",
        "allowed_use",
        "prohibited_use",
        "license_status",
        "review_status",
        "provenance",
        "update_date",
    ):
        if key not in man:
            errors.append(f"missing:{key}")
    entry_counts: dict[str, int] = {}
    for name in man.get("files", []):
        data = _read(RESOURCES_DIR / str(name))
        blob = json.dumps(data, ensure_ascii=False)
        for leak in ("mai04_", "mai05_", "expected_view", "prohibited_for_training"):
            if leak in blob:
                errors.append(f"eval_leakage:{name}:{leak}")
        if "entries" in data and isinstance(data["entries"], dict):
            entry_counts[str(name)] = len(data["entries"])
        elif "entries" in data and isinstance(data["entries"], list):
            entry_counts[str(name)] = len(data["entries"])
        elif "map" in data:
            entry_counts[str(name)] = len(data["map"])
        elif "thresholds" in data:
            entry_counts[str(name)] = len(data["thresholds"])
        elif "categories" in data:
            entry_counts[str(name)] = sum(len(v) for v in data["categories"].values())
        else:
            entry_counts[str(name)] = 0
    computed = compute_pack_content_hash(man)
    if computed != man.get("content_hash"):
        errors.append(f"hash_mismatch:{man.get('content_hash')}:{computed}")
    return {
        "ok": not errors,
        "errors": errors,
        "content_hash": computed,
        "entry_counts": entry_counts,
        "resource_pack_version": man.get("resource_pack_version"),
    }


def load_resources(*, force_reload: bool = False) -> CompactNormResources:
    global _CACHE, _LOAD_MS
    with _LOCK:
        if _CACHE is not None and not force_reload:
            return _CACHE
        import time

        t0 = time.perf_counter()
        man = _read(RESOURCES_DIR / "manifest.json")
        ws = _read(RESOURCES_DIR / "whitespace_equivalence.json")
        dig = _read(RESOURCES_DIR / "digit_equivalence.json")
        punct = _read(RESOURCES_DIR / "punctuation_candidates.json")
        abbr = _read(RESOURCES_DIR / "abbreviation_candidates.json")
        rep = _read(RESOURCES_DIR / "repetition_thresholds.json")
        sec = _read(RESOURCES_DIR / "security_categories.json")
        res = CompactNormResources(
            manifest=man,
            whitespace_map={str(k): str(v) for k, v in ws.get("map", {}).items()},
            digit_map={str(k): str(v) for k, v in dig.get("map", {}).items()},
            punctuation_candidates={str(k): list(v) for k, v in punct.get("entries", {}).items()},
            abbreviations={str(k).lower(): list(v) for k, v in abbr.get("entries", {}).items()},
            repetition_min_run=int(rep.get("thresholds", {}).get("min_run", 3)),
            security_categories={str(k): list(v) for k, v in sec.get("categories", {}).items()},
            version=str(man.get("resource_pack_version", "mai-06.1.0")),
            content_hash=str(man.get("content_hash", "")),
        )
        _LOAD_MS = (time.perf_counter() - t0) * 1000
        _CACHE = res
        return res


def last_load_ms() -> float | None:
    return _LOAD_MS


def main() -> None:
    import argparse
    import sys

    p = argparse.ArgumentParser()
    p.add_argument("--seal", action="store_true")
    p.add_argument("--check-twice", action="store_true")
    args = p.parse_args()
    if args.check_twice:
        seal_manifest_hash()
        b1 = (RESOURCES_DIR / "manifest.json").read_bytes()
        seal_manifest_hash()
        b2 = (RESOURCES_DIR / "manifest.json").read_bytes()
        report = validate_resources()
        report["second_run_no_diff"] = b1 == b2
        print(json.dumps(report, indent=2, sort_keys=True))
        sys.exit(0 if report["ok"] and report["second_run_no_diff"] else 1)
    if args.seal:
        seal_manifest_hash()
    print(json.dumps(validate_resources(), indent=2, sort_keys=True))
    sys.exit(0 if validate_resources()["ok"] else 1)


if __name__ == "__main__":
    main()
