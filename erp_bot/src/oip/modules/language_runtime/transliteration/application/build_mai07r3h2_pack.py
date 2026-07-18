"""Build immutable versioned resource pack mai-07.1.5-r3h2-shared.

Derives from the sealed R3H pack (mai-07.1.4-r3h-englishid), replacing only the
versioned identity-disposition policy config with the R3H2 shared-collision
generalization. Overlay remains disabled; historical/active-default packs are
untouched — ACTIVE_PACK_VERSION in resource_repository.py is not modified here.

CLI:
  --check         read-only validate an existing DEST pack (no writes)
  --check-twice   dual isolated temp build; never writes DEST
  (default)       build + promote to DEST; requires MAI07_AUTHORIZE_PACK_PROMOTE=1
                  if DEST exists with different content; refuses overwrite of
                  differing sealed content
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

REPO = Path(__file__).resolve().parents[7]
XL = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
SOURCE_PACK_VERSION = "mai-07.1.4-r3h-englishid"
SOURCE = XL / "sealed_packs" / SOURCE_PACK_VERSION
PACK_VERSION = "mai-07.1.5-r3h2-shared"
PACK_ID = "mai07_transliteration_pack_r3h2_shared_collision"
DEST = XL / "sealed_packs" / PACK_VERSION
POLICY_SOURCE = XL / "resources" / "r3h2_english_identity_policy.json"
AUTHORIZE_PROMOTE_ENV = "MAI07_AUTHORIZE_PACK_PROMOTE"

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


def _write_json(path: Path, obj: dict) -> None:
    path.write_text(
        json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def _materialize(dest_dir: Path) -> dict:
    dest_dir.mkdir(parents=True, exist_ok=True)
    for name in ALLOWED_FILES:
        shutil.copy2(SOURCE / name, dest_dir / name)
        try:
            os.chmod(dest_dir / name, 0o644)
        except OSError:
            pass
    # R3H2 policy replaces the versioned identity-disposition guard config only.
    shutil.copy2(POLICY_SOURCE, dest_dir / "r3f_english_identity_guard.json")
    content_hash = resource_content_sha256(resources_dir=dest_dir, file_names=ALLOWED_FILES)
    man = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    man.update(
        {
            "resource_id": PACK_ID,
            "resource_pack_version": PACK_VERSION,
            "content_hash": content_hash,
            "update_date": "2026-07-16",
            "seal_contract_version": SEAL_CONTRACT_VERSION,
            "provenance": (
                "MAI-07R3H2: new sealed pack derived from mai-07.1.4-r3h-englishid; "
                "identity-disposition policy generalized for shared-collision cases "
                "(English/Romanized/ambiguous-context surface collisions); "
                "overlay remains disabled; historical packs unchanged; "
                "active default pack (mai-07.1.3-r3f-sealnew) unchanged."
            ),
        }
    )
    _write_json(dest_dir / "manifest.json", man)
    seal_v2 = build_resource_seal_fields(resources_dir=dest_dir, manifest=man)
    man["seal_v2"] = seal_v2
    _write_json(dest_dir / "manifest.json", man)
    return {
        "content_hash": content_hash,
        "manifest": man,
        "manifest_raw_sha256": sha256_file(dest_dir / "manifest.json"),
    }


def _dual_build() -> tuple[dict, dict]:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    if not POLICY_SOURCE.exists():
        raise FileNotFoundError(POLICY_SOURCE)
    with tempfile.TemporaryDirectory(prefix="mai07_r3h2_pack_a_") as ta, tempfile.TemporaryDirectory(
        prefix="mai07_r3h2_pack_b_"
    ) as tb:
        a = Path(ta)
        b = Path(tb)
        ra = _materialize(a)
        rb = _materialize(b)
        if ra["content_hash"] != rb["content_hash"]:
            raise RuntimeError("dual_build_content_hash_mismatch")
        for name in ["manifest.json", *ALLOWED_FILES]:
            if (a / name).read_bytes() != (b / name).read_bytes():
                raise RuntimeError(f"dual_build_byte_mismatch:{name}")
        return ra, rb


def check_twice() -> dict:
    """Dual isolated temp build only — never writes DEST."""
    ra, _rb = _dual_build()
    return {
        "ok": True,
        "pack_version": PACK_VERSION,
        "source_pack_version": SOURCE_PACK_VERSION,
        "resource_content_sha256": ra["content_hash"],
        "dual_build_identical": True,
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "promoted": False,
        "dest_touched": False,
    }


def check_existing() -> dict:
    """Read-only validation of an existing DEST pack. Never writes."""
    if not DEST.exists():
        return {"ok": False, "error": "dest_not_sealed", "dest": str(DEST)}
    man = json.loads((DEST / "manifest.json").read_text(encoding="utf-8"))
    claimed = man.get("content_hash")
    computed = resource_content_sha256(resources_dir=DEST, file_names=ALLOWED_FILES)
    errors = []
    if claimed != computed:
        errors.append(f"hash_mismatch:claimed={claimed}:computed={computed}")
    if man.get("resource_pack_version") != PACK_VERSION:
        errors.append("pack_version_mismatch")
    return {
        "ok": not errors,
        "errors": errors,
        "pack_version": man.get("resource_pack_version"),
        "content_hash": computed,
        "claimed_content_hash": claimed,
        "dest": str(DEST),
    }


def build_pack(*, promote: bool = True) -> dict:
    """Dual-build the pack; promote to DEST only when explicitly requested.

    Refuses to overwrite a DEST that already carries different sealed content.
    Promotion over an existing (different) DEST requires
    MAI07_AUTHORIZE_PACK_PROMOTE=1. Never mutates ACTIVE_PACK_VERSION defaults.
    """
    ra, _rb = _dual_build()
    report = {
        "ok": True,
        "pack_version": PACK_VERSION,
        "source_pack_version": SOURCE_PACK_VERSION,
        "resource_content_sha256": ra["content_hash"],
        "dual_build_identical": True,
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "promoted": False,
        "active_pack_version_unchanged": True,
    }
    if not promote:
        return report
    if DEST.exists():
        existing = json.loads((DEST / "manifest.json").read_text(encoding="utf-8"))
        if existing.get("content_hash") == ra["content_hash"]:
            report["already_sealed"] = True
            return report
        if os.environ.get(AUTHORIZE_PROMOTE_ENV) != "1":
            raise PermissionError(
                f"Refusing to overwrite sealed pack at {DEST} with different content. "
                f"Set {AUTHORIZE_PROMOTE_ENV}=1 to authorize promotion of a genuinely new pack "
                "at a new content hash, or seal under a new pack_version directory instead."
            )
        raise RuntimeError(
            f"refusing to overwrite sealed pack at {DEST}: content differs even with "
            f"{AUTHORIZE_PROMOTE_ENV}=1 — seal a new pack_version instead of mutating an existing one"
        )
    with tempfile.TemporaryDirectory(prefix="mai07_r3h2_pack_promote_") as tp:
        p = Path(tp)
        _materialize(p)
        shutil.copytree(p, DEST)
    for f in DEST.glob("*.json"):
        try:
            os.chmod(f, 0o444)
        except OSError:
            pass
    report["promoted"] = True
    report["dest_manifest_raw_sha256"] = sha256_file(DEST / "manifest.json")
    return report


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Read-only validate existing DEST pack")
    parser.add_argument("--check-twice", action="store_true", help="Dual isolated temp build; no promote")
    args = parser.parse_args()
    if args.check:
        report = check_existing()
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        return 0 if report["ok"] else 1
    if args.check_twice:
        report = check_twice()
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        return 0 if report["ok"] else 1
    report = build_pack(promote=True)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
