#!/usr/bin/env python3
"""Build multi-page document comprehension scenario corpus from user paste JSONL."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "data" / "nepal-ai" / "documents"
PASTE = DOCS / "_user_doccmp_paste.jsonl"
OUT_JSONL = DOCS / "document_comprehension_scenarios.jsonl"
OUT_EXPORT = DOCS / "document_comprehension_scenarios_export.json"
OUT_MAP = DOCS / "document_comprehension_scenario_query_map.json"
OUT_BY_TYPE = DOCS / "document_comprehension_scenarios_by_type.json"


def slug_document_type(document_type: str) -> str:
    base = document_type.strip()
    paren = ""
    m = re.match(r"^(.+?)\s*\(([^)]+)\)\s*$", base)
    if m:
        base, suffix = m.group(1), m.group(2)
        paren = "_" + re.sub(r"[^a-z0-9]+", "_", suffix.lower()).strip("_")
    key = re.sub(r"[^a-zA-Z0-9]+", "_", base.lower()).strip("_")
    key = re.sub(r"_+", "_", key)
    return (key + paren).strip("_")


def normalize_key(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().strip().rstrip("?!."))


def load_paste_rows() -> list[dict]:
    rows: list[dict] = []
    for line in PASTE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def normalize_row(row: dict) -> dict:
    qa = row.get("questions_this_document_can_answer")
    if qa is None:
        qa = row.get("questions_this_document_can-answer") or []
    return {
        "document_type": row.get("document_type") or "",
        "document_structure": row.get("document_structure") or {},
        "sample_content_sections": row.get("sample_content_sections") or [],
        "questions_this_document_can_answer": qa,
        "data_extraction_tasks": row.get("data_extraction_tasks") or [],
    }


def enrich(rows: list[dict]) -> list[dict]:
    out: list[dict] = []
    for i, row in enumerate(rows, start=1):
        norm = normalize_row(row)
        doc_type = norm["document_type"]
        scenario_id = f"doccmp_{i:03d}"
        out.append(
            {
                "id": scenario_id,
                "source": "user_exact",
                "scenario_id": scenario_id,
                "document_type": doc_type,
                "document_type_key": slug_document_type(doc_type),
                "document_structure": norm["document_structure"],
                "sample_content_sections": norm["sample_content_sections"],
                "questions_this_document_can_answer": norm["questions_this_document_can_answer"],
                "data_extraction_tasks": norm["data_extraction_tasks"],
                "intent": "document_comprehension",
                "NOT_transaction": True,
                "NOT_question": False,
                "domain": "document_comprehension",
            }
        )
    return out


def build_query_map(rows: list[dict]) -> dict:
    query_map: dict = {}

    for row in rows:
        meta = {
            "id": row["id"],
            "documentType": row["document_type"],
            "documentTypeKey": row["document_type_key"],
        }

        def add(alias: str) -> None:
            if not alias:
                return
            key = normalize_key(alias)
            if key in query_map:
                return
            query_map[key] = meta

        add(row["document_type"])
        add(row["document_type_key"])
        add(row["scenario_id"])
        add(row["id"])

        for qa in row.get("questions_this_document_can_answer") or []:
            if isinstance(qa, dict):
                add(qa.get("q") or "")

    return query_map


def build_by_type(rows: list[dict]) -> dict:
    by_type: dict[str, list[str]] = {}
    for row in rows:
        key = row["document_type_key"]
        by_type.setdefault(key, []).append(row["id"])
    return by_type


def main() -> int:
    if not PASTE.exists():
        print(f"Missing paste file: {PASTE}")
        return 1

    rows = enrich(load_paste_rows())
    query_map = build_query_map(rows)
    by_type = build_by_type(rows)

    with OUT_JSONL.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    OUT_EXPORT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_MAP.write_text(json.dumps(query_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_BY_TYPE.write_text(json.dumps(by_type, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"rows={len(rows)}")
    print(f"first={rows[0]['id']} type={rows[0]['document_type_key']}")
    print(f"last={rows[-1]['id']} type={rows[-1]['document_type_key']}")
    print(f"type_keys={len(by_type)}")
    print(f"aliases={len(query_map)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
