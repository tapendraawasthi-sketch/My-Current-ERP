#!/usr/bin/env python3
"""Generate data/ekhata/vocabulary/master.json from category JSON files."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.knowledge.vocabulary_loader import build_master_vocabulary, write_master_vocabulary


def main() -> int:
    path = write_master_vocabulary()
    master = build_master_vocabulary()
    print(f"Wrote {path}")
    print(
        f"  categories={master['category_count']} "
        f"terms={master['term_count']} "
        f"spelling_aliases={master['spelling_alias_count']} "
        f"payment_aliases={master['payment_alias_count']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
