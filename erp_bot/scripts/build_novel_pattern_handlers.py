#!/usr/bin/env python3
"""Build novel-pattern generalization golden corpus from user paste JSONL."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANG = ROOT / "data" / "nepal-ai" / "language"
PASTE = LANG / "_user_novel_paste.jsonl"
OUT_JSONL = LANG / "novel_pattern_handlers.jsonl"
OUT_EXPORT = LANG / "novel_pattern_handlers_export.json"
OUT_MAP = LANG / "novel_pattern_handler_query_map.json"
OUT_BY_INTENT = LANG / "novel_pattern_handlers_by_intent.json"


def normalize_key(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().strip().rstrip("?!."))


def slug_intent(intent: str) -> str:
    key = re.sub(r"[^a-zA-Z0-9]+", "_", (intent or "unknown").lower()).strip("_")
    return re.sub(r"_+", "_", key) or "unknown"


def load_paste_rows() -> list[dict]:
    rows: list[dict] = []
    for line in PASTE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def enrich(rows: list[dict]) -> list[dict]:
    out: list[dict] = []
    for i, row in enumerate(rows, start=1):
        novel_id = f"novel_{i:03d}"
        handling = row.get("suggested_handling") or {}
        intent = str(handling.get("intent") or "")
        out.append(
            {
                "id": novel_id,
                "source": "user_exact",
                "novel_id": novel_id,
                "input": row["input"],
                "input_normalized": normalize_key(row["input"]),
                "why_novel": row.get("why_novel") or "",
                "nearest_known_pattern": row.get("nearest_known_pattern") or "",
                "reasoning_to_handle": row.get("reasoning_to_handle") or [],
                "suggested_handling": handling,
                "suggested_intent": intent,
                "suggested_intent_key": slug_intent(intent),
                "suggested_entities": handling.get("entities") or {},
                "clarify_if_needed": handling.get("clarify_if_needed") or "",
                "generalization_lesson": row.get("generalization_lesson") or "",
                "intent": "novel_pattern_handler",
                "NOT_transaction": False,
                "domain": "novel_pattern_generalization",
            }
        )
    return out


def build_query_map(rows: list[dict]) -> dict:
    query_map: dict = {}

    for row in rows:
        meta = {
            "id": row["id"],
            "suggestedIntent": row["suggested_intent"],
            "suggestedIntentKey": row["suggested_intent_key"],
        }

        def add(alias: str) -> None:
            if not alias:
                return
            key = alias if alias == row["input"] else normalize_key(alias)
            if key in query_map:
                return
            query_map[key] = meta

        add(row["input"])
        add(row["input_normalized"])
        add(row["novel_id"])

    return query_map


def build_by_intent(rows: list[dict]) -> dict:
    by_intent: dict[str, list[str]] = {}
    for row in rows:
        key = row["suggested_intent_key"]
        by_intent.setdefault(key, []).append(row["id"])
    return by_intent


def main() -> int:
    if not PASTE.exists():
        print(f"Missing paste file: {PASTE}")
        return 1

    rows = enrich(load_paste_rows())
    query_map = build_query_map(rows)
    by_intent = build_by_intent(rows)

    with OUT_JSONL.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    OUT_EXPORT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_MAP.write_text(json.dumps(query_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_BY_INTENT.write_text(json.dumps(by_intent, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"rows={len(rows)}")
    print(f"first={rows[0]['id']} intent={rows[0]['suggested_intent']}")
    print(f"last={rows[-1]['id']} intent={rows[-1]['suggested_intent']}")
    print(f"intent_keys={len(by_intent)}")
    print(f"aliases={len(query_map)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
