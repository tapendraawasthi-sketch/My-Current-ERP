#!/usr/bin/env python3
"""Ingest sector NLU knowledge chunks into Chroma for hybrid retrieval."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.vectorstore.nlu_knowledge_store import (  # noqa: E402
    get_nlu_knowledge_count,
    ingest_nlu_knowledge,
    is_nlu_chunk,
)
from src.knowledge.knowledge_registry import load_all_chunks  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest NLU knowledge embeddings")
    parser.add_argument("--force", action="store_true", help="Re-ingest all NLU chunks")
    args = parser.parse_args()

    nlu_chunks = [c for c in load_all_chunks() if is_nlu_chunk(c)]
    print(f"NLU-eligible chunks: {len(nlu_chunks)}")
    result = ingest_nlu_knowledge(force=args.force)
    print(f"Result: {result}")
    print(f"Collection count: {get_nlu_knowledge_count()}")
    return 0 if result.get("status") != "error" else 1


if __name__ == "__main__":
    raise SystemExit(main())
