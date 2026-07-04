#!/usr/bin/env python3
"""Mine user-confirmed e-Khata feedback into eval/training candidates (Step 7).

Reads data/ekhata/user-feedback.jsonl and writes:
  - data/ekhata/eval-feedback-candidates.jsonl (for CA review → eval-test-set.json)
  - data/ekhata/feedback-training-export.jsonl (LoRA-ready confirmed examples)

Usage:
  python3 erp_bot/scripts/mine_feedback_to_eval.py
  python3 erp_bot/scripts/mine_feedback_to_eval.py --stats
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
FEEDBACK_FILE = ROOT / "data" / "ekhata" / "user-feedback.jsonl"
EVAL_CANDIDATES = ROOT / "data" / "ekhata" / "eval-feedback-candidates.jsonl"
TRAINING_EXPORT = ROOT / "data" / "ekhata" / "feedback-training-export.jsonl"


def load_feedback() -> list[dict]:
    if not FEEDBACK_FILE.exists():
        return []
    rows = []
    for line in FEEDBACK_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def to_eval_candidate(row: dict) -> dict:
    narration = row.get("correctedNarration") or row.get("narration", "")
    return {
        "id": f"FB-{row.get('id', 'unknown')}",
        "source": "user_feedback",
        "label": row.get("label"),
        "category": "user_confirmed" if row.get("label") == "confirmed" else "user_corrected",
        "input": narration,
        "expected": {
            "type": "entry",
            "intent": row.get("intent"),
            "amount": row.get("amount"),
            "party": row.get("party"),
        },
        "mined_at": datetime.now(timezone.utc).isoformat(),
    }


def to_training_row(row: dict) -> dict:
    narration = row.get("correctedNarration") or row.get("narration", "")
    output = {
        "intent": row.get("intent"),
        "amount": row.get("amount"),
        "party": row.get("party"),
        "journalLines": row.get("journalLines"),
    }
    return {
        "instruction": "You are e-Khata CA parser. Parse the Nepal accounting transaction to structured JSON.",
        "input": narration,
        "output": json.dumps({k: v for k, v in output.items() if v is not None}, ensure_ascii=False),
        "source": "user_feedback",
        "label": row.get("label"),
    }


def append_jsonl(path: Path, rows: list[dict]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    existing_ids = set()
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                try:
                    existing_ids.add(json.loads(line).get("id") or json.loads(line).get("input"))
                except json.JSONDecodeError:
                    pass

    written = 0
    with path.open("a", encoding="utf-8") as fh:
        for row in rows:
            key = row.get("id") or row.get("input")
            if key in existing_ids:
                continue
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            written += 1
    return written


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stats", action="store_true", help="Print feedback stats only")
    args = parser.parse_args()

    rows = load_feedback()
    counts = {"confirmed": 0, "cancelled": 0, "corrected": 0, "total": len(rows)}
    for row in rows:
        label = str(row.get("label", "")).lower()
        if label in counts:
            counts[label] += 1

    if args.stats:
        print(json.dumps(counts, indent=2))
        return 0

    usable = [r for r in rows if r.get("label") in ("confirmed", "corrected") and r.get("narration")]
    eval_rows = [to_eval_candidate(r) for r in usable]
    train_rows = [to_training_row(r) for r in usable if r.get("label") in ("confirmed", "corrected")]

    eval_written = append_jsonl(EVAL_CANDIDATES, eval_rows)
    train_written = append_jsonl(TRAINING_EXPORT, train_rows)

    print(f"Feedback total: {counts['total']} (confirmed={counts['confirmed']}, corrected={counts['corrected']})")
    print(f"Eval candidates appended: {eval_written} → {EVAL_CANDIDATES}")
    print(f"Training export appended: {train_written} → {TRAINING_EXPORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
