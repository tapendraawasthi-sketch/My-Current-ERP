#!/usr/bin/env python3
"""Build code-mixed multilingual utterance golden corpus from user paste JSONL."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANG = ROOT / "data" / "nepal-ai" / "language"
PASTE = LANG / "_user_cmix_paste.jsonl"
OUT_JSONL = LANG / "code_mixed_utterances.jsonl"
OUT_EXPORT = LANG / "code_mixed_utterances_export.json"
OUT_MAP = LANG / "code_mixed_utterance_query_map.json"
OUT_BY_INTENT = LANG / "code_mixed_utterances_by_intent.json"


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
        intent = str(row.get("intent") or "")
        normalized = str(row.get("normalized") or row.get("input") or "")
        out.append(
            {
                "id": f"cmix-{i:03d}",
                "source": "user_exact",
                "input": row["input"],
                "input_normalized": normalize_key(row["input"]),
                "normalized": normalized,
                "languages_detected": row.get("languages_detected") or [],
                "language_spans": row.get("language_spans") or [],
                "intent": intent,
                "intent_key": intent,
                "entities": row.get("entities") or {},
                "NOT_transaction": True,
                "domain": "multilingual_nlu",
            }
        )
    return out


def build_query_map(rows: list[dict]) -> dict:
    query_map: dict = {}

    for row in rows:
        meta = {
            "id": row["id"],
            "intent": row["intent"],
            "intentKey": row["intent_key"],
        }

        def add(alias: str) -> None:
            key = normalize_key(alias)
            if not key or key in query_map:
                return
            query_map[key] = meta

        add(row["input"])
        add(row.get("normalized") or "")
        add(row["input_normalized"])

    return query_map


def build_by_intent(rows: list[dict]) -> dict:
    by_intent: dict[str, list[str]] = {}
    for row in rows:
        key = row["intent_key"]
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
    print(f"first={rows[0]['id']} {rows[0]['intent']}")
    print(f"last={rows[-1]['id']} {rows[-1]['intent']}")
    print(f"unique_intents={len(by_intent)}")
    print(f"aliases={len(query_map)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
