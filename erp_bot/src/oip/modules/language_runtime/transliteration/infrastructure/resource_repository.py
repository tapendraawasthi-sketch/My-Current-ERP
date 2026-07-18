"""Compact MAI-07 transliteration resource pack — load once, network-free.

Sealing policy (MAI-07R3F-SEAL-RESTORE):
- validate_resources / --check / --check-twice are read-only w.r.t. canonical paths.
- seal_manifest_hash requires an explicit output path and AUTHORIZED_SEAL=1.
- Ordinary tests must never seal canonical resources.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_LOCK = threading.Lock()
_CACHE: CompactXlResources | None = None

_XL_ROOT = Path(__file__).resolve().parent.parent
# Active sealed pack remains the historical R3F seal-new pack by default.
# R3H corrective artifacts are built and evaluated explicitly without mutating
# historical active-path defaults.
ACTIVE_PACK_VERSION = "mai-07.1.3-r3f-sealnew"
RESOURCES_DIR = _XL_ROOT / "sealed_packs" / ACTIVE_PACK_VERSION
HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR = _XL_ROOT / "resources"
HISTORICAL_INVALIDATED_R3F_CONTENT_HASH_CLAIM = (
    "e94cc8c7775d9ce77ab854ab478387d950a018ba1b76d96e9749d4aad425e50a"
)


@dataclass(frozen=True)
class CompactXlResources:
    manifest: dict[str, Any]
    lexicon: dict[str, list[str]]
    grapheme_rules: list[tuple[str, str, float]]
    morphology: dict[str, list[str]]
    ambiguity: dict[str, list[str]]
    domain_terms: dict[str, list[str]]
    context_rules: list[dict[str, Any]]
    english_identity: frozenset[str]
    name_like: frozenset[str]
    ranking_config: dict[str, Any]
    promotion_overlay_config: dict[str, Any]
    english_identity_guard: dict[str, Any]
    version: str
    content_hash: str


def _read(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def compute_pack_content_hash(
    manifest: dict[str, Any] | None = None,
    *,
    resources_dir: Path | None = None,
) -> str:
    """SHA-256 over sorted (filename + NUL + raw file bytes) for manifest['files'].

    Does not include manifest.json itself. Uses raw bytes (no newline normalization).
    """
    base = resources_dir or RESOURCES_DIR
    man = manifest or _read(base / "manifest.json")
    h = hashlib.sha256()
    for name in sorted(str(x) for x in man.get("files", [])):
        h.update(name.encode("utf-8"))
        h.update(b"\0")
        h.update((base / name).read_bytes())
    return h.hexdigest()


def seal_manifest_hash(
    *,
    output_manifest_path: Path | None = None,
    resources_dir: Path | None = None,
    authorize_canonical_seal: bool = False,
) -> str:
    """Write content_hash into a manifest.

    Default refuses to write into the canonical RESOURCES_DIR unless
    authorize_canonical_seal=True and env MAI07_AUTHORIZE_RESOURCE_SEAL=1.
    Prefer sealing into an explicit temporary output path.
    """
    base = resources_dir or RESOURCES_DIR
    out = output_manifest_path or (base / "manifest.json")
    protected = {
        (RESOURCES_DIR / "manifest.json").resolve(),
        (HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR / "manifest.json").resolve(),
    }
    protected_dirs = {RESOURCES_DIR.resolve(), HISTORICAL_INVALIDATED_R3F_RESOURCES_DIR.resolve()}
    if out.resolve() in protected or base.resolve() in protected_dirs:
        if not authorize_canonical_seal or os.environ.get("MAI07_AUTHORIZE_RESOURCE_SEAL") != "1":
            raise PermissionError(
                "Refusing to seal canonical/historical transliteration resources. "
                "Pass output_manifest_path to a temp dir, or set "
                "authorize_canonical_seal=True and MAI07_AUTHORIZE_RESOURCE_SEAL=1."
            )
    man = _read(base / "manifest.json")
    digest = compute_pack_content_hash(man, resources_dir=base)
    man["content_hash"] = digest
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(man, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return digest


def validate_resources(*, resources_dir: Path | None = None) -> dict[str, Any]:
    """Read-only validation. Never updates claims."""
    base = resources_dir or RESOURCES_DIR
    man = _read(base / "manifest.json")
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
        data = _read(base / str(name))
        blob = json.dumps(data, ensure_ascii=False)
        for leak in ("mai04_", "mai05_", "mai06_", "mai07_", "expected_view", "prohibited_for_training"):
            if leak in blob and name != "manifest.json":
                if "mai07_case" in blob or "expected_candidates" in blob:
                    errors.append(f"eval_leakage:{name}")
        if "entries" in data and isinstance(data["entries"], dict):
            entry_counts[str(name)] = len(data["entries"])
        elif "entries" in data and isinstance(data["entries"], list):
            entry_counts[str(name)] = len(data["entries"])
        elif "rules" in data and isinstance(data["rules"], list):
            entry_counts[str(name)] = len(data["rules"])
        elif "map" in data:
            entry_counts[str(name)] = len(data["map"])
        else:
            entry_counts[str(name)] = 0
    computed = compute_pack_content_hash(man, resources_dir=base)
    claimed = man.get("content_hash")
    if computed != claimed:
        errors.append(f"hash_mismatch:expected={claimed}:actual={computed}")
    return {
        "ok": not errors,
        "errors": errors,
        "content_hash": computed,
        "claimed_content_hash": claimed,
        "entry_counts": entry_counts,
        "resource_pack_version": man.get("resource_pack_version"),
        "resources_dir": str(base),
        "mutated_canonical": False,
    }


def check_twice_isolated() -> dict[str, Any]:
    """Seal twice in isolated temp directories; never write canonical resources."""
    with tempfile.TemporaryDirectory(prefix="mai07_xl_check_") as td1, tempfile.TemporaryDirectory(
        prefix="mai07_xl_check_"
    ) as td2:
        d1 = Path(td1)
        d2 = Path(td2)
        for name in ["manifest.json", *(_read(RESOURCES_DIR / "manifest.json").get("files", []))]:
            src = RESOURCES_DIR / str(name)
            if src.exists():
                shutil.copy2(src, d1 / str(name))
                shutil.copy2(src, d2 / str(name))
                # Sealed packs may be OS read-only; temp copies must be writable for isolated seal.
                for dest in (d1 / str(name), d2 / str(name)):
                    try:
                        os.chmod(dest, 0o644)
                    except OSError:
                        pass
        h1 = seal_manifest_hash(output_manifest_path=d1 / "manifest.json", resources_dir=d1)
        h2 = seal_manifest_hash(output_manifest_path=d2 / "manifest.json", resources_dir=d2)
        b1 = (d1 / "manifest.json").read_bytes()
        b2 = (d2 / "manifest.json").read_bytes()
        report = validate_resources(resources_dir=d1)
        report["second_run_no_diff"] = b1 == b2 and h1 == h2
        report["isolated_seal_hash_1"] = h1
        report["isolated_seal_hash_2"] = h2
        report["canonical_untouched"] = True
        return report


def load_resources(*, force_reload: bool = False, resources_dir: Path | None = None) -> CompactXlResources:
    """Load CompactXlResources.

    When resources_dir is None, uses the historical active default pack
    (mai-07.1.3-r3f-sealnew) and the process-wide cache.
    Explicit resources_dir loads that pack without mutating the default cache
    unless resources_dir resolves to RESOURCES_DIR.
    """
    global _CACHE
    base = (resources_dir or RESOURCES_DIR).resolve()
    use_cache = resources_dir is None or base == RESOURCES_DIR.resolve()
    with _LOCK:
        if use_cache and _CACHE is not None and not force_reload:
            return _CACHE
        man = _read(base / "manifest.json")
        lex = _read(base / "romanized_lexicon.json")
        graph = _read(base / "grapheme_rules.json")
        morph = _read(base / "morphology_rules.json")
        amb = _read(base / "ambiguity_rules.json")
        domain = _read(base / "domain_terms.json")
        ctx = _read(base / "context_rules.json")
        eng = _read(base / "english_identity.json")
        names = _read(base / "name_like_terms.json")
        ranking_path = base / "ranking_config.json"
        ranking_cfg = _read(ranking_path) if ranking_path.exists() else {}
        overlay_path = base / "promotion_overlay_config.json"
        overlay_cfg = _read(overlay_path) if overlay_path.exists() else {}
        guard_path = base / "r3f_english_identity_guard.json"
        guard_cfg = _read(guard_path) if guard_path.exists() else {}
        rules: list[tuple[str, str, float]] = []
        for r in graph.get("rules", []):
            rules.append((str(r["roman"]).lower(), str(r["devanagari"]), float(r.get("cost", 1.0))))
        rules.sort(key=lambda x: (-len(x[0]), x[0], x[1]))
        res = CompactXlResources(
            manifest=man,
            lexicon={str(k).lower(): [str(x) for x in v] for k, v in lex.get("entries", {}).items()},
            grapheme_rules=rules,
            morphology={str(k).lower(): [str(x) for x in v] for k, v in morph.get("entries", {}).items()},
            ambiguity={str(k).lower(): [str(x) for x in v] for k, v in amb.get("entries", {}).items()},
            domain_terms={str(k).lower(): [str(x) for x in v] for k, v in domain.get("entries", {}).items()},
            context_rules=list(ctx.get("rules", [])),
            english_identity=frozenset(str(x).lower() for x in eng.get("entries", [])),
            name_like=frozenset(str(x).lower() for x in names.get("entries", [])),
            ranking_config=dict(ranking_cfg),
            promotion_overlay_config=dict(overlay_cfg),
            english_identity_guard=dict(guard_cfg),
            version=str(man.get("resource_pack_version", "mai-07.1.0")),
            content_hash=str(man.get("content_hash", "")),
        )
        if use_cache:
            _CACHE = res
        return res


def main() -> None:
    import argparse
    import sys

    p = argparse.ArgumentParser()
    p.add_argument("--seal", action="store_true", help="Requires --output and MAI07_AUTHORIZE_RESOURCE_SEAL=1 for canonical")
    p.add_argument("--output", type=str, default="", help="Manifest output path for --seal")
    p.add_argument("--check", action="store_true", help="Read-only validate (default)")
    p.add_argument("--check-twice", action="store_true", help="Isolated temp seals only; never touches canonical")
    args = p.parse_args()
    if args.check_twice:
        report = check_twice_isolated()
        print(json.dumps(report, indent=2, sort_keys=True))
        sys.exit(0 if report["ok"] and report["second_run_no_diff"] else 1)
    if args.seal:
        if not args.output:
            print(json.dumps({"ok": False, "error": "seal_requires_--output"}, indent=2))
            sys.exit(2)
        digest = seal_manifest_hash(output_manifest_path=Path(args.output))
        print(json.dumps({"ok": True, "content_hash": digest, "output": args.output}, indent=2))
        sys.exit(0)
    # default / --check: read-only
    print(json.dumps(validate_resources(), indent=2, sort_keys=True))
    sys.exit(0 if validate_resources()["ok"] else 1)


if __name__ == "__main__":
    main()
