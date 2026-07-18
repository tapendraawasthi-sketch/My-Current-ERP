"""Build immutable versioned resource pack mai-07.1.4-r3h-englishid.

Copies the active R3F seal-new pack contents, replaces only the versioned
identity policy config, and seals the result under contract v2.0.0.
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
SOURCE = XL / "sealed_packs" / "mai-07.1.3-r3f-sealnew"
PACK_VERSION = "mai-07.1.4-r3h-englishid"
PACK_ID = "mai07_transliteration_pack_r3h_englishid"
DEST = XL / "sealed_packs" / PACK_VERSION
POLICY_SOURCE = XL / "resources" / "r3h_english_identity_policy.json"

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
                "MAI-07R3H: new sealed pack derived from mai-07.1.3-r3f-sealnew; "
                "identity-disposition policy generalized for English/shared-term collisions; "
                "overlay remains disabled; historical packs unchanged."
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


def build_pack(*, promote: bool = True) -> dict:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    if not POLICY_SOURCE.exists():
        raise FileNotFoundError(POLICY_SOURCE)
    with tempfile.TemporaryDirectory(prefix="mai07_r3h_pack_a_") as ta, tempfile.TemporaryDirectory(
        prefix="mai07_r3h_pack_b_"
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
        report = {
            "ok": True,
            "pack_version": PACK_VERSION,
            "source_pack_version": "mai-07.1.3-r3f-sealnew",
            "resource_content_sha256": ra["content_hash"],
            "dual_build_identical": True,
            "seal_contract_version": SEAL_CONTRACT_VERSION,
            "promoted": False,
        }
        if promote:
            if DEST.exists():
                existing = json.loads((DEST / "manifest.json").read_text(encoding="utf-8"))
                if existing.get("content_hash") == ra["content_hash"]:
                    report["already_sealed"] = True
                    return report
                raise RuntimeError(f"refusing to overwrite sealed pack at {DEST}")
            shutil.copytree(a, DEST)
            for p in DEST.glob("*.json"):
                try:
                    os.chmod(p, 0o444)
                except OSError:
                    pass
            report["promoted"] = True
            report["dest_manifest_raw_sha256"] = sha256_file(DEST / "manifest.json")
        return report


def main() -> int:
    print(json.dumps(build_pack(promote=True), ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
