#!/usr/bin/env python3
"""Force a full rebuild of the ChromaDB codebase index."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.ingestion import embedder

if __name__ == "__main__":
    result = embedder.ingest_all()
    print(
        f"Done: {result['indexed']}/{result['total_files']} indexed, "
        f"{result['skipped']} skipped, {len(result['errors'])} errors"
    )
    if result["errors"]:
        print("Errors:", result["errors"][:10])
