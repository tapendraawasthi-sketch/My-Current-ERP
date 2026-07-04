"""Orchestrate the ingest-one-file and ingest-all pipelines."""

from __future__ import annotations

import json
from pathlib import Path

from ..config import ERP_PATH
from ..vectorstore import chroma_store
from . import parser, scanner

# Path to the manifest file that tracks indexed file mtimes
_BOT_ROOT = Path(__file__).resolve().parent.parent.parent
_MANIFEST_PATH = _BOT_ROOT / "data" / "index_manifest.json"


def _relative(file_path: Path) -> str:
    try:
        return str(file_path.relative_to(ERP_PATH))
    except ValueError:
        return str(file_path)


def _load_manifest() -> dict[str, float]:
    """Load the index manifest (relative_path → mtime) from disk."""
    if not _MANIFEST_PATH.exists():
        return {}
    try:
        with open(_MANIFEST_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def _save_manifest(manifest: dict[str, float]) -> None:
    """Save the index manifest to disk."""
    _MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(_MANIFEST_PATH, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
    except OSError as e:
        print(f"[WARN] Could not save index manifest: {e}")


def ingest_file(file_path: Path) -> dict:
    chunks = parser.chunk_file(file_path)
    if not chunks:
        return {"file": str(file_path), "status": "skipped", "chunks": 0}

    rel = _relative(file_path)
    chroma_store.delete_by_file(rel)
    chroma_store.upsert_chunks(chunks)
    print(f"[INDEXED] {rel} — {len(chunks)} chunks")
    return {"file": str(file_path), "status": "indexed", "chunks": len(chunks)}


def ingest_all(base_path: Path | None = None) -> dict:
    files = scanner.get_all_files(base_path)
    total = len(files)
    indexed = 0
    skipped = 0
    errors: list[dict] = []

    for i, path in enumerate(files, 1):
        if i % 25 == 0 or i == total:
            print(f"[PROGRESS] {i}/{total} files processed")

        try:
            result = ingest_file(path)
            if result["status"] == "indexed":
                indexed += 1
            else:
                skipped += 1
        except Exception as e:
            errors.append({"file": str(path), "error": str(e)})

    # Update manifest with all current file mtimes after full ingest
    manifest = {}
    for path in files:
        rel = _relative(path)
        try:
            manifest[rel] = path.stat().st_mtime
        except OSError:
            pass
    _save_manifest(manifest)

    return {
        "total_files": total,
        "indexed": indexed,
        "skipped": skipped,
        "errors": errors,
    }


def sync_changed_files(base_path: Path | None = None) -> dict:
    """Incrementally sync the index by re-ingesting only changed/new files.

    Compares current file mtimes against a stored manifest and:
    - Re-indexes files that are new or have newer mtimes.
    - Removes from index any files that no longer exist.

    Returns a summary dict with counts of added, updated, removed, and errors.
    """
    if base_path is None:
        base_path = ERP_PATH

    manifest = _load_manifest()
    current_files = scanner.get_all_files(base_path)

    # Build set of current relative paths
    current_rel_paths: set[str] = set()
    file_map: dict[str, Path] = {}
    for path in current_files:
        rel = _relative(path)
        current_rel_paths.add(rel)
        file_map[rel] = path

    # Find files to add/update and files to remove
    to_reindex: list[tuple[str, Path]] = []
    removed_count = 0
    errors: list[dict] = []

    # Check for new or modified files
    for rel, path in file_map.items():
        try:
            current_mtime = path.stat().st_mtime
        except OSError:
            continue

        old_mtime = manifest.get(rel)
        if old_mtime is None or current_mtime > old_mtime:
            to_reindex.append((rel, path))

    # Check for deleted files (in manifest but not on disk)
    for rel in list(manifest.keys()):
        if rel not in current_rel_paths:
            try:
                chroma_store.delete_by_file(rel)
                del manifest[rel]
                removed_count += 1
                print(f"[REMOVED] {rel}")
            except Exception as e:
                errors.append({"file": rel, "error": f"delete failed: {e}"})

    # Re-index changed/new files
    added_count = 0
    updated_count = 0
    for rel, path in to_reindex:
        was_in_manifest = rel in manifest
        try:
            result = ingest_file(path)
            if result["status"] == "indexed":
                # Update manifest with new mtime
                manifest[rel] = path.stat().st_mtime
                if was_in_manifest:
                    updated_count += 1
                else:
                    added_count += 1
        except Exception as e:
            errors.append({"file": str(path), "error": str(e)})

    # Save updated manifest
    _save_manifest(manifest)

    total_changes = added_count + updated_count + removed_count
    if total_changes == 0:
        print("[SYNC] Index is up to date — no changes detected.")
    else:
        print(
            f"[SYNC] Complete: {added_count} added, {updated_count} updated, "
            f"{removed_count} removed, {len(errors)} errors"
        )

    return {
        "added": added_count,
        "updated": updated_count,
        "removed": removed_count,
        "errors": errors,
        "total_changes": total_changes,
    }
