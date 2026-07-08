"""Persist user-confirmed e-Khata entries for LoRA re-training."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..config import ERP_PATH

FEEDBACK_DIR = ERP_PATH / "data" / "ekhata"
FEEDBACK_FILE = FEEDBACK_DIR / "user-feedback.jsonl"


def _ensure_dir() -> None:
    FEEDBACK_DIR.mkdir(parents=True, exist_ok=True)


def append_feedback(record: dict[str, Any]) -> dict[str, Any]:
    """Append one feedback record; returns stored record with id if missing."""
    _ensure_dir()
    stored = dict(record)
    stored.setdefault("id", f"{int(datetime.now(timezone.utc).timestamp() * 1000)}")
    stored.setdefault("timestamp", datetime.now(timezone.utc).isoformat())

    with FEEDBACK_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(stored, ensure_ascii=False) + "\n")

    try:
        from .feedback_promoter import maybe_auto_promote_on_append

        maybe_auto_promote_on_append(stored)
    except Exception:
        pass

    return stored


def append_feedback_bulk(records: list[dict[str, Any]]) -> dict[str, Any]:
    stored_rows = [append_feedback(record) for record in records]
    return {"count": len(stored_rows), "stats": feedback_stats()}


def feedback_stats() -> dict[str, Any]:
    if not FEEDBACK_FILE.exists():
        return {"confirmed": 0, "cancelled": 0, "corrected": 0, "total": 0}

    counts = {"confirmed": 0, "cancelled": 0, "corrected": 0, "total": 0}
    with FEEDBACK_FILE.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            label = str(row.get("label", "")).lower()
            if label in counts:
                counts[label] += 1
            counts["total"] += 1
    return counts
