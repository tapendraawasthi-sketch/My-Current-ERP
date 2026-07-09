#!/usr/bin/env python3
"""Build English word sense context golden corpus from user paste JSONL."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANG = ROOT / "data" / "nepal-ai" / "language"
PASTE = LANG / "_user_wctx_paste.jsonl"
OUT_JSONL = LANG / "word_sense_contexts.jsonl"
OUT_EXPORT = LANG / "word_sense_contexts_export.json"
OUT_MAP = LANG / "word_sense_context_query_map.json"
OUT_BY_WORD = LANG / "word_sense_contexts_by_word.json"


def normalize_key(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().strip().rstrip("?!."))


def slug_word(word: str) -> str:
    key = re.sub(r"[^a-zA-Z0-9]+", "_", word.lower()).strip("_")
    return re.sub(r"_+", "_", key)


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
        word = str(row["word"])
        out.append(
            {
                "id": f"wctx-{i:03d}",
                "source": "user_exact",
                "word": word,
                "word_key": slug_word(word),
                "contexts": row["contexts"],
                "disambiguation_strategy": row["disambiguation_strategy"],
                "intent": "word_sense_disambiguation",
                "NOT_transaction": True,
                "domain": "english_polysemy",
            }
        )
    return out


def build_query_map(rows: list[dict]) -> dict:
    query_map: dict = {}

    for row in rows:
        meta = {
            "id": row["id"],
            "word": row["word"],
            "wordKey": row["word_key"],
        }

        def add(alias: str) -> None:
            key = normalize_key(alias)
            if not key or key in query_map:
                return
            query_map[key] = meta

        add(row["word"])
        add(row["word_key"])
        for ctx in row.get("contexts") or []:
            add(ctx.get("example") or "")
            ex = str(ctx.get("example") or "")
            if ex:
                add(f"{row['word']} {ex}")

    return query_map


def build_by_word(rows: list[dict]) -> dict:
    by_word: dict[str, list[str]] = {}
    for row in rows:
        key = row["word_key"]
        by_word.setdefault(key, []).append(row["id"])
    return by_word


def main() -> int:
    if not PASTE.exists():
        print(f"Missing paste file: {PASTE}")
        return 1

    rows = enrich(load_paste_rows())
    query_map = build_query_map(rows)
    by_word = build_by_word(rows)

    with OUT_JSONL.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    OUT_EXPORT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_MAP.write_text(json.dumps(query_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_BY_WORD.write_text(json.dumps(by_word, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"rows={len(rows)}")
    print(f"first={rows[0]['id']} {rows[0]['word']}")
    print(f"last={rows[-1]['id']} {rows[-1]['word']}")
    print(f"aliases={len(query_map)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
