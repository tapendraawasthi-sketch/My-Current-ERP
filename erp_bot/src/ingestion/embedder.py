"""Orchestrate the ingest-one-file and ingest-all pipelines."""

from __future__ import annotations

from pathlib import Path

from ..config import ERP_PATH
from ..vectorstore import chroma_store
from . import parser, scanner


def _relative(file_path: Path) -> str:
    try:
        return str(file_path.relative_to(ERP_PATH))
    except ValueError:
        return str(file_path)


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

    return {
        "total_files": total,
        "indexed": indexed,
        "skipped": skipped,
        "errors": errors,
    }
