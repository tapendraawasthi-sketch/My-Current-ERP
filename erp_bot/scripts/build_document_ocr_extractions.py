#!/usr/bin/env python3
"""Build document OCR extraction golden corpus from user paste JSONL."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "data" / "nepal-ai" / "documents"
PASTE = DOCS / "_user_ocr_paste.jsonl"
OUT_JSONL = DOCS / "document_ocr_extractions.jsonl"
OUT_EXPORT = DOCS / "document_ocr_extractions_export.json"
OUT_MAP = DOCS / "document_ocr_extraction_query_map.json"
OUT_BY_TYPE = DOCS / "document_ocr_extractions_by_type.json"


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


def first_line(text: str, max_len: int = 80) -> str:
    for line in text.splitlines():
        line = line.strip()
        if line:
            return line[:max_len]
    return ""


def load_paste_rows() -> list[dict]:
    text = PASTE.read_text(encoding="utf-8").strip()
    rows: list[dict] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def enrich(rows: list[dict]) -> list[dict]:
    out: list[dict] = []
    for i, row in enumerate(rows, start=1):
        doc_type = row["document_type"]
        enriched = {
            "id": f"docex-{i:03d}",
            "source": "user_exact",
            "document_type": doc_type,
            "document_type_key": slug_document_type(doc_type),
            "intent": "document_ocr_extraction",
            "NOT_transaction": True,
            "domain": "nepal_documents",
            "raw_ocr_text": row["raw_ocr_text"],
            "ocr_errors": row["ocr_errors"],
            "corrected_text": row["corrected_text"],
            "extracted_data": row["extracted_data"],
            "validation": row["validation"],
        }
        out.append(enriched)
    return out


def build_query_map(rows: list[dict]) -> dict:
    query_map: dict = {}
    for row in rows:
        meta = {
            "id": row["id"],
            "document_type": row["document_type"],
            "document_type_key": row["document_type_key"],
        }

        def add(alias: str) -> None:
            key = normalize_key(alias)
            if not key or key in query_map:
                return
            query_map[key] = meta

        add(row["document_type"])
        add(row["document_type_key"].replace("_", " "))

        base = row["document_type"]
        m = re.match(r"^(.+?)\s*\(", base)
        if m:
            add(m.group(1).strip())

        fl = first_line(row["raw_ocr_text"])
        if len(fl) >= 8:
            add(fl)

        extracted = row.get("extracted_data") or {}
        inv = extracted.get("invoice_no")
        if inv:
            add(f"invoice {inv}")
            add(f"invoice no {inv}")
        pan = extracted.get("pan")
        if pan:
            add(f"pan {pan}")

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
    print(f"first={rows[0]['id']} {rows[0]['document_type']}")
    print(f"last={rows[-1]['id']} {rows[-1]['document_type']}")
    print(f"unique_type_keys={len(by_type)}")
    print(f"aliases={len(query_map)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
