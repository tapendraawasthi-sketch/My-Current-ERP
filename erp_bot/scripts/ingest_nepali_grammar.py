#!/usr/bin/env python3
"""Embed Nepali grammar reference into ChromaDB via Ollama nomic-embed-text."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.vectorstore.nepali_grammar_store import (
    get_nepali_grammar_count,
    grammar_reference_exists,
    ingest_nepali_grammar,
)


def main() -> None:
    if not grammar_reference_exists():
        print("[NEPALI GRAMMAR] Reference not found under data/ekhata/source/")
        sys.exit(1)

    print("[NEPALI GRAMMAR] Embedding grammar chunks into ChromaDB (Ollama nomic-embed-text)...")
    result = ingest_nepali_grammar()
    print(f"[NEPALI GRAMMAR] Result: {result}")
    print(f"[NEPALI GRAMMAR] Indexed chunks: {get_nepali_grammar_count()}")


if __name__ == "__main__":
    main()
