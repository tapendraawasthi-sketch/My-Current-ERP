#!/usr/bin/env python3
"""Build financial statement interpretation golden corpus from user paste JSONL."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANG = ROOT / "data" / "nepal-ai" / "language"
PASTE = LANG / "_user_finstmt_paste.jsonl"
OUT_JSONL = LANG / "financial_statement_interpretations.jsonl"
OUT_EXPORT = LANG / "financial_statement_interpretations_export.json"
OUT_MAP = LANG / "financial_statement_interpretation_query_map.json"
OUT_BY_TYPE = LANG / "financial_statement_interpretations_by_type.json"


def slug_statement_type(statement_type: str) -> str:
    key = re.sub(r"[^a-zA-Z0-9]+", "_", statement_type.lower()).strip("_")
    return re.sub(r"_+", "_", key)


def normalize_key(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().strip().rstrip("?!."))


def company_from_heading(heading: str) -> str:
    return heading.split("\\n")[0].strip()


def load_paste_rows() -> list[dict]:
    text = PASTE.read_text(encoding="utf-8").strip()
    rows: list[dict] = []
    for line in text.splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def enrich(rows: list[dict]) -> list[dict]:
    out: list[dict] = []
    for i, row in enumerate(rows, start=1):
        stmt_type = row["statement_type"]
        fmt = row.get("format") or "vertical"
        out.append(
            {
                "id": f"finstmt-{i:03d}",
                "source": "user_exact",
                "statement_type": stmt_type,
                "statement_type_key": slug_statement_type(stmt_type),
                "format": fmt,
                "format_key": fmt.lower(),
                "intent": "financial_statement_interpretation",
                "NOT_transaction": True,
                "domain": "nepal_accounting",
                "sample_data": row["sample_data"],
                "questions_about_this": row["questions_about_this"],
                "interpretation": row["interpretation"],
            }
        )
    return out


def build_query_map(rows: list[dict]) -> dict:
    query_map: dict = {}

    for row in rows:
        meta = {
            "id": row["id"],
            "statement_type": row["statement_type"],
            "statement_type_key": row["statement_type_key"],
        }

        def add(alias: str) -> None:
            key = normalize_key(alias)
            if not key or key in query_map:
                return
            query_map[key] = meta

        add(row["statement_type"])
        add(row["statement_type_key"].replace("_", " "))
        add(f"{row['format']} {row['statement_type']}")

        heading = (row.get("sample_data") or {}).get("heading") or ""
        company = company_from_heading(heading)
        if company:
            add(company)
            add(f"{company} {row['statement_type']}")

        for qa in row.get("questions_about_this") or []:
            q = qa.get("q") or ""
            if q:
                add(q)

    return query_map


def build_by_type(rows: list[dict]) -> dict:
    by_type: dict[str, list[str]] = {}
    for row in rows:
        key = row["statement_type_key"]
        by_type.setdefault(key, []).append(row["id"])
    return by_type


def main() -> int:
    if not PASTE.exists():
        print(f"Missing paste file: {PASTE}")
        return 1

    raw = load_paste_rows()
    rows = enrich(raw)
    query_map = build_query_map(rows)
    by_type = build_by_type(rows)

    with OUT_JSONL.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    OUT_EXPORT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_MAP.write_text(json.dumps(query_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_BY_TYPE.write_text(json.dumps(by_type, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"rows={len(rows)}")
    print(f"first={rows[0]['id']} {rows[0]['statement_type']}")
    print(f"last={rows[-1]['id']} {rows[-1]['statement_type']}")
    print(f"unique_type_keys={len(by_type)}")
    print(f"aliases={len(query_map)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
