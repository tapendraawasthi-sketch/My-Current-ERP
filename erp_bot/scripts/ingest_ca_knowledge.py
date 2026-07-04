#!/usr/bin/env python3
"""Ingest IFRS Conceptual Framework knowledge into ChromaDB ca_knowledge collection."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.vectorstore.ca_knowledge_store import ingest_ca_knowledge, get_ca_knowledge_count


def main() -> None:
    print("[CA KNOWLEDGE] Ingesting IFRS Conceptual Framework...")
    result = ingest_ca_knowledge()
    print(f"[CA KNOWLEDGE] Result: {result}")
    print(f"[CA KNOWLEDGE] Total chunks in collection: {get_ca_knowledge_count()}")


if __name__ == "__main__":
    main()
