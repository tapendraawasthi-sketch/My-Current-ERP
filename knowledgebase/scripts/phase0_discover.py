#!/usr/bin/env python3
"""KB Phase 0 — Discover and inventory ZIP source archives safely (no extraction)."""

from __future__ import annotations

import argparse
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

from kb_common import (
    FILENAME_RE,
    REPO_ROOT,
    atomic_write_json,
    atomic_write_text,
    is_safe_zip_member,
    load_config,
    parse_file_id,
    rel_to_repo,
    setup_logging,
    sha256_file,
    update_phase,
    utc_now_iso,
)

logger = setup_logging("phase0_discover")

FILE_ID_RE = re.compile(r"ORBIX_NP_LANG_KB_(\d{4})_", re.IGNORECASE)


def discover_zips(source_dir: Path) -> list[Path]:
    if not source_dir.is_dir():
        raise FileNotFoundError(f"Source directory not found: {source_dir}")
    return sorted(p for p in source_dir.iterdir() if p.is_file() and p.suffix.lower() == ".zip")


def inspect_zip(repo_root: Path, zpath: Path) -> dict[str, Any]:
    digest = sha256_file(zpath)
    members_meta: list[dict[str, Any]] = []
    accepted: list[str] = []
    rejected: list[dict[str, str]] = []
    numbered: list[str] = []
    duplicate_members: list[str] = []
    seen_names: set[str] = set()
    unsafe_paths: list[dict[str, str]] = []
    unsupported: list[str] = []

    with zipfile.ZipFile(zpath, "r") as zf:
        # Detect symlink/hardlink if ZipInfo supports external_attr / create_system
        for info in zf.infolist():
            name = info.filename
            norm = name.replace("\\", "/")
            if norm in seen_names:
                duplicate_members.append(norm)
            seen_names.add(norm)

            # Zip symlink flag (Unix): external_attr high bits == 0o120000
            is_symlink = False
            if info.create_system == 3:  # Unix
                mode = (info.external_attr >> 16) & 0o170000
                is_symlink = mode == 0o120000

            safe, reason = is_safe_zip_member(name)
            if info.is_dir():
                rejected.append({"member": name, "reason": "directory_entry"})
                continue
            if is_symlink:
                unsafe_paths.append({"member": name, "reason": "symbolic_link"})
                rejected.append({"member": name, "reason": "symbolic_link"})
                continue
            if not safe:
                entry = {"member": name, "reason": reason or "unsafe"}
                if reason in {
                    "path_traversal",
                    "absolute_path",
                    "drive_letter_path",
                    "home_relative_path",
                }:
                    unsafe_paths.append(entry)
                if reason == "unsupported_extension":
                    unsupported.append(name)
                rejected.append(entry)
                continue

            # Accept only .txt
            accepted.append(name)
            mid = parse_file_id(Path(name).name)
            if mid:
                numbered.append(mid)
            elif FILENAME_RE.match(Path(name).name) is None and "MANIFEST" not in name.upper():
                # Non-numbered but txt — still accepted as optional manifest-like
                pass

            members_meta.append(
                {
                    "member": name,
                    "compress_size": info.compress_size,
                    "file_size": info.file_size,
                    "CRC": info.CRC,
                    "is_numbered_kb_file": bool(mid),
                    "file_id": mid,
                }
            )

    numbered_sorted = sorted(set(numbered))
    file_ids_int = sorted(int(x) for x in numbered_sorted)
    range_desc = None
    if file_ids_int:
        range_desc = f"{min(file_ids_int):04d}-{max(file_ids_int):04d}"

    return {
        "filename": zpath.name,
        "relative_path": rel_to_repo(repo_root, zpath),
        "size_bytes": zpath.stat().st_size,
        "sha256": digest,
        "member_count": len(seen_names),
        "accepted_member_count": len(accepted),
        "rejected_member_count": len(rejected),
        "numbered_file_ids": numbered_sorted,
        "numbered_file_count": len(numbered_sorted),
        "numbered_file_range": range_desc,
        "duplicate_members": duplicate_members,
        "unsafe_paths": unsafe_paths,
        "unsupported_file_types": unsupported,
        "rejected_members": rejected,
        "accepted_members": accepted,
        "members": members_meta,
    }


def build_markdown(inventory: dict[str, Any]) -> str:
    lines = [
        "# Source Archive Inventory (Phase 0)",
        "",
        f"Generated: {inventory['generated_at']}",
        f"Source directory: `{inventory['source_dir']}`",
        "",
        "## Summary",
        "",
        f"- ZIP archives found: **{inventory['archive_count']}**",
        f"- Numbered files identified (union): **{inventory['combined_numbered_file_count']}**",
        f"- Expected: **{inventory['expected_file_count']}** (0001–0088)",
        f"- Missing IDs: {inventory['missing_file_ids'] or 'none'}",
        f"- Duplicate IDs across archives: {inventory['duplicate_file_ids_across_archives'] or 'none'}",
        f"- Phase 0 status: **{inventory['phase0_status']}**",
        "",
        "## Archives",
        "",
    ]
    for arch in inventory["archives"]:
        lines.extend(
            [
                f"### `{arch['filename']}`",
                "",
                f"- Relative path: `{arch['relative_path']}`",
                f"- Size: {arch['size_bytes']} bytes",
                f"- SHA-256: `{arch['sha256']}`",
                f"- Members: {arch['member_count']}",
                f"- Accepted: {arch['accepted_member_count']}",
                f"- Rejected: {arch['rejected_member_count']}",
                f"- Numbered range: {arch['numbered_file_range']}",
                f"- Duplicate members: {arch['duplicate_members'] or 'none'}",
                f"- Unsafe paths: {arch['unsafe_paths'] or 'none'}",
                f"- Unsupported types: {arch['unsupported_file_types'] or 'none'}",
                "",
            ]
        )
    lines.extend(
        [
            "## Numbered file coverage",
            "",
            "```",
            ", ".join(inventory["combined_numbered_file_ids"]),
            "```",
            "",
            "## Notes",
            "",
            "- ZIP files were inspected without extraction.",
            "- Original ZIP files must not be moved, renamed, modified, or overwritten.",
            "- Source directory discovered as configured / fallback `Knowledge source`.",
            "",
        ]
    )
    return "\n".join(lines)


def run(source_dir: Path, review_dir: Path, manifests_dir: Path, repo_root: Path) -> int:
    update_phase(
        "0",
        name="Discovery and Source Inventory",
        status="in_progress",
        start=True,
        next_phase="1",
        commands=[
            f"python knowledgebase/scripts/phase0_discover.py --source-dir {source_dir}"
        ],
    )

    zips = discover_zips(source_dir)
    archives = [inspect_zip(repo_root, z) for z in zips]

    id_sources: dict[str, list[str]] = {}
    for arch in archives:
        for fid in arch["numbered_file_ids"]:
            id_sources.setdefault(fid, []).append(arch["filename"])

    combined_ids = sorted(id_sources.keys())
    expected = [f"{i:04d}" for i in range(1, 89)]
    missing = [x for x in expected if x not in id_sources]
    duplicates = sorted(fid for fid, srcs in id_sources.items() if len(srcs) > 1)

    unsafe_any = any(a["unsafe_paths"] or a["duplicate_members"] for a in archives)
    status = "passed"
    blockers: list[str] = []
    warnings: list[str] = []
    if len(combined_ids) != 88 or missing:
        status = "failed"
        blockers.append(
            f"Expected 88 numbered files 0001-0088; found {len(combined_ids)}; missing {missing}"
        )
    if duplicates:
        warnings.append(f"Duplicate numbered IDs across archives: {duplicates}")
        if status == "passed":
            status = "passed_with_warnings"
    if unsafe_any:
        warnings.append("One or more archives contain unsafe or duplicate members (blocked from extraction).")
        if status == "passed":
            status = "passed_with_warnings"
    if len(archives) != 2:
        warnings.append(f"Expected 2 ZIP archives; found {len(archives)}")
        if status == "passed":
            status = "passed_with_warnings"

    inventory = {
        "generated_at": utc_now_iso(),
        "source_dir": rel_to_repo(repo_root, source_dir),
        "archive_count": len(archives),
        "expected_file_count": 88,
        "combined_numbered_file_ids": combined_ids,
        "combined_numbered_file_count": len(combined_ids),
        "missing_file_ids": missing,
        "duplicate_file_ids_across_archives": duplicates,
        "file_id_sources": id_sources,
        "phase0_status": status,
        "archives": archives,
    }

    review_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)
    inv_json = review_dir / "source_archive_inventory.json"
    inv_md = review_dir / "source_archive_inventory.md"
    sums = manifests_dir / "SOURCE_SHA256SUMS.txt"

    atomic_write_json(inv_json, inventory)
    atomic_write_text(inv_md, build_markdown(inventory))
    sum_lines = [
        f"{a['sha256']}  {a['relative_path']}" for a in archives
    ]
    atomic_write_text(sums, "\n".join(sum_lines) + ("\n" if sum_lines else ""))

    update_phase(
        "0",
        name="Discovery and Source Inventory",
        status=status if status != "failed" else "failed",
        finish=True,
        commands=[
            f"python knowledgebase/scripts/phase0_discover.py --source-dir \"{source_dir}\""
        ],
        tests=["manual inventory assertions in script"],
        outputs=[
            rel_to_repo(repo_root, inv_json),
            rel_to_repo(repo_root, inv_md),
            rel_to_repo(repo_root, sums),
        ],
        findings=[
            f"Found {len(archives)} ZIP(s)",
            f"Combined numbered files: {len(combined_ids)}",
            f"Missing: {missing or 'none'}",
        ],
        blockers=blockers,
        warnings=warnings,
        next_phase="1" if status != "failed" else "blocked",
        extra={"sha256_sums": {a["filename"]: a["sha256"] for a in archives}},
    )

    logger.info("Phase 0 %s — %d numbered files identified", status, len(combined_ids))
    return 0 if status in {"passed", "passed_with_warnings"} else 1


def main(argv: list[str] | None = None) -> int:
    cfg = load_config()
    parser = argparse.ArgumentParser(description="Phase 0: discover KB ZIP archives")
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=REPO_ROOT,
        help="Repository root (default: auto-detected)",
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=None,
        help="Directory containing ZIP archives",
    )
    parser.add_argument(
        "--review-dir",
        type=Path,
        default=None,
    )
    parser.add_argument(
        "--manifests-dir",
        type=Path,
        default=None,
    )
    args = parser.parse_args(argv)
    repo_root = args.repo_root.resolve()
    source_dir = (
        args.source_dir.resolve()
        if args.source_dir
        else (repo_root / cfg["paths"]["source_dir"]).resolve()
    )
    # Fallback: also try "knowledgebase file" if configured path missing
    if not source_dir.is_dir():
        alt = repo_root / "knowledgebase file"
        if alt.is_dir():
            source_dir = alt.resolve()
    review_dir = (
        args.review_dir.resolve()
        if args.review_dir
        else (repo_root / cfg["paths"]["review_dir"]).resolve()
    )
    manifests_dir = (
        args.manifests_dir.resolve()
        if args.manifests_dir
        else (repo_root / cfg["paths"]["manifests_dir"]).resolve()
    )
    try:
        return run(source_dir, review_dir, manifests_dir, repo_root)
    except Exception as exc:
        logger.exception("Phase 0 failed: %s", exc)
        update_phase(
            "0",
            name="Discovery and Source Inventory",
            status="failed",
            finish=True,
            blockers=[str(exc)],
            next_phase="blocked",
        )
        return 2


if __name__ == "__main__":
    sys.exit(main())
