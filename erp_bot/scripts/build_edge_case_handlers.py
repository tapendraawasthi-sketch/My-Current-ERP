#!/usr/bin/env python3
"""Build edge-case handler golden corpus from user paste JSONL."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANG = ROOT / "data" / "nepal-ai" / "language"
PASTE = LANG / "_user_edge_paste.jsonl"
OUT_JSONL = LANG / "edge_case_handlers.jsonl"
OUT_EXPORT = LANG / "edge_case_handlers_export.json"
OUT_MAP = LANG / "edge_case_handler_query_map.json"
OUT_BY_CATEGORY = LANG / "edge_case_handlers_by_category.json"


def normalize_key(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().strip().rstrip("?!."))


def load_paste_rows() -> list[dict]:
    rows: list[dict] = []
    for line in PASTE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def enrich(rows: list[dict]) -> list[dict]:
    out: list[dict] = []
    for row in rows:
        strategy = row.get("handling_strategy") or {}
        category = str(row.get("category") or "")
        out.append(
            {
                "id": str(row.get("edge_case_id") or ""),
                "source": "user_exact",
                "edge_case_id": row.get("edge_case_id"),
                "category": category,
                "category_key": category,
                "input": row["input"],
                "input_normalized": normalize_key(row["input"]),
                "context_note": row.get("context") or "",
                "without_context_interpretation": row.get("without_context_interpretation") or "",
                "with_context_interpretation": row.get("with_context_interpretation") or "",
                "handling_if_context": strategy.get("if_context_available") or "",
                "handling_if_no_context": strategy.get("if_no_context") or "",
                "similar_cases": row.get("similar_cases") or [],
                "test_priority": row.get("test_priority") or "medium",
                "intent": "edge_case_handler",
                "NOT_transaction": True,
                "domain": "edge_case_nlu",
            }
        )
    return out


def build_query_map(rows: list[dict]) -> dict:
    query_map: dict = {}

    for row in rows:
        meta = {
            "id": row["id"],
            "category": row["category"],
            "categoryKey": row["category_key"],
            "testPriority": row["test_priority"],
        }

        def add(alias: str) -> None:
            key = normalize_key(alias)
            if not key or key in query_map:
                return
            query_map[key] = meta

        add(row["input"])
        add(row["input_normalized"])
        add(row["edge_case_id"])

    return query_map


def build_by_category(rows: list[dict]) -> dict:
    by_cat: dict[str, list[str]] = {}
    for row in rows:
        key = row["category_key"]
        by_cat.setdefault(key, []).append(row["id"])
    return by_cat


def main() -> int:
    if not PASTE.exists():
        print(f"Missing paste file: {PASTE}")
        return 1

    rows = enrich(load_paste_rows())
    query_map = build_query_map(rows)
    by_category = build_by_category(rows)

    with OUT_JSONL.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    OUT_EXPORT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_MAP.write_text(json.dumps(query_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_BY_CATEGORY.write_text(
        json.dumps(by_category, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"rows={len(rows)}")
    print(f"first={rows[0]['id']} {rows[0]['category']}")
    print(f"last={rows[-1]['id']} {rows[-1]['category']}")
    print(f"categories={len(by_category)}")
    print(f"aliases={len(query_map)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
