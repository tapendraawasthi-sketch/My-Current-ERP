#!/usr/bin/env python3
"""Ingest Nepali grammar reference into ChromaDB for e-Khata Ollama retrieval."""

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
        print("[NEPALI GRAMMAR] Reference file not found at data/ekhata/source/nepali-grammar-reference.txt")
        sys.exit(1)

    print("[NEPALI GRAMMAR] Ingesting complete Nepali grammar reference...")
    result = ingest_nepali_grammar()
    print(f"[NEPALI GRAMMAR] Result: {result}")
    print(f"[NEPALI GRAMMAR] Total chunks in collection: {get_nepali_grammar_count()}")


if __name__ == "__main__":
    main()
