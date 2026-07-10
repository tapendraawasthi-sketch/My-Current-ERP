"""Schema SQL loader."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def load_schema_sql() -> str:
    path = Path(__file__).resolve().parent.parent / "schema.sql"
    text = path.read_text(encoding="utf-8")
    lines = [
        ln
        for ln in text.splitlines()
        if ln.strip() and not ln.strip().startswith("--")
    ]
    return "\n".join(lines)
