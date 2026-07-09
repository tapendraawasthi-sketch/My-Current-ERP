#!/usr/bin/env python3
"""Build accounting comparison golden corpus from user paste JSONL."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANG = ROOT / "data" / "nepal-ai" / "language"
PASTE = LANG / "_user_acmp_paste.jsonl"
OUT_JSONL = LANG / "accounting_comparisons.jsonl"
OUT_EXPORT = LANG / "accounting_comparisons_export.json"
OUT_MAP = LANG / "accounting_comparison_query_map.json"
OUT_BY_TOPIC = LANG / "accounting_comparisons_by_topic.json"


def slug_topic(topic: str) -> str:
    key = re.sub(r"[^a-zA-Z0-9]+", "_", topic.lower()).strip("_")
    return re.sub(r"_+", "_", key)


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
    for i, row in enumerate(rows, start=1):
        topic = row["topic"]
        out.append(
            {
                "id": f"acmp-{i:03d}",
                "source": "user_exact",
                "topic": topic,
                "topic_key": slug_topic(topic),
                "question_ne": row["question_ne"],
                "question_normalized": normalize_key(row["question_ne"]),
                "comparison_table": row["comparison_table"],
                "explanation_ne": row["explanation_ne"],
                "when_to_use_a": row["when_to_use_a"],
                "when_to_use_b": row["when_to_use_b"],
                "intent": "accounting_comparison",
                "NOT_transaction": True,
                "domain": "nepal_accounting",
            }
        )
    return out


def build_query_map(rows: list[dict]) -> dict:
    query_map: dict = {}

    for row in rows:
        meta = {
            "id": row["id"],
            "topic": row["topic"],
            "topic_key": row["topic_key"],
        }

        def add(alias: str) -> None:
            key = normalize_key(alias)
            if not key or key in query_map:
                return
            query_map[key] = meta

        add(row["topic"])
        add(row["topic_key"].replace("_", " "))
        add(row["question_ne"])
        add(row["question_normalized"])

        parts = re.split(r"\s+vs\s+", row["topic"], flags=re.I)
        if len(parts) == 2:
            add(f"{parts[0].strip()} vs {parts[1].strip()}")
            add(f"{parts[0].strip()} ra {parts[1].strip()}")

    return query_map


def build_by_topic(rows: list[dict]) -> dict:
    by_topic: dict[str, list[str]] = {}
    for row in rows:
        key = row["topic_key"]
        by_topic.setdefault(key, []).append(row["id"])
    return by_topic


def main() -> int:
    if not PASTE.exists():
        print(f"Missing paste file: {PASTE}")
        return 1

    rows = enrich(load_paste_rows())
    query_map = build_query_map(rows)
    by_topic = build_by_topic(rows)

    with OUT_JSONL.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    OUT_EXPORT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_MAP.write_text(json.dumps(query_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_BY_TOPIC.write_text(json.dumps(by_topic, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"rows={len(rows)}")
    print(f"first={rows[0]['id']} {rows[0]['topic']}")
    print(f"last={rows[-1]['id']} {rows[-1]['topic']}")
    print(f"unique_topics={len(by_topic)}")
    print(f"aliases={len(query_map)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
