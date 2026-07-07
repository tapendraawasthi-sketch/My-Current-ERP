#!/usr/bin/env python3
"""Ingest Nepal Accounting KB Phase 1 into tiered knowledge segments."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KNOWLEDGE = ROOT / "data" / "ekhata" / "knowledge"
SOURCE = "Nepal Accounting KB Phase 1 (AI Training — verify tax/legal with IRD/CA)"


def write_jsonl(rel_path: str, chunks: list[dict]) -> int:
    path = KNOWLEDGE / rel_path
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    return len(chunks)


def chunk(
    cid: str,
    title: str,
    content: str,
    segment: str,
    *,
    tags: list[str] | None = None,
    language: list[str] | None = None,
    extra: dict | None = None,
) -> dict:
    row = {
        "id": cid,
        "title": title,
        "content": content.strip(),
        "segment": segment,
        "language": language or ["nepali", "english", "romanized"],
        "tags": tags or [],
        "source": SOURCE,
    }
    if extra:
        row.update(extra)
    return row
