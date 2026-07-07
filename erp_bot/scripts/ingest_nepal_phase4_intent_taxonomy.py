#!/usr/bin/env python3
"""Ingest Phase 4 transaction intent taxonomy into general/intent-taxonomy."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = "Nepal SME ERP Phase 4 Intent Taxonomy (AI Training)"
SEGMENT = "general.intent-taxonomy"
OUT_REL = "data/ekhata/knowledge/general/intent-taxonomy/nepal-phase4-intents.jsonl"

CATEGORY_LABELS = {
    "SAL": "Sales",
    "PUR": "Purchase",
    "EXP": "Expense",
    "CB": "Cash/Bank",
    "INV": "Inventory",
    "AST": "Assets/Liabilities",
    "TAX": "Tax/Compliance",
    "COR": "Correction",
}


def category_prefix(intent_code: str) -> str:
    return (intent_code or "").split("-")[0].upper()


def build_content(row: dict) -> str:
    code = row.get("intent_code") or ""
    cat = category_prefix(code)
    parts = [
        f"PHASE 4 INTENT TAXONOMY — {code} {row.get('intent_name', '')}",
        f"Category: {cat} ({CATEGORY_LABELS.get(cat, cat)})",
        f"English meaning: {row.get('simple_meaning_en', '')}",
        f"Nepali meaning: {row.get('simple_meaning_np', '')}",
    ]
    if row.get("romanized_examples"):
        parts.append(f"Romanized examples: {', '.join(row['romanized_examples'])}")
    if row.get("english_examples"):
        parts.append(f"English examples: {', '.join(row['english_examples'])}")
    if row.get("required_fields"):
        parts.append(f"Required fields: {', '.join(row['required_fields'])}")
    if row.get("optional_fields"):
        parts.append(f"Optional fields: {', '.join(row['optional_fields'])}")
    if row.get("journal_entry_rule"):
        parts.append(f"Journal entry rule: {row['journal_entry_rule']}")
    if row.get("inventory_rule"):
        parts.append(f"Inventory rule: {row['inventory_rule']}")
    if row.get("tax_rule_placeholder"):
        parts.append(f"Tax rule placeholder: {row['tax_rule_placeholder']}")
    if row.get("clarification_questions"):
        parts.append("Clarification questions:")
        for q in row["clarification_questions"]:
            parts.append(f"  - {q}")
    if row.get("example_user_inputs"):
        parts.append(f"Example user inputs: {', '.join(row['example_user_inputs'])}")
    if row.get("example_erp_output"):
        parts.append(f"Example ERP output: {row['example_erp_output']}")
    return "\n".join(parts)


def row_to_chunk(row: dict) -> dict:
    code = row.get("intent_code") or "UNKNOWN"
    cat = category_prefix(code)
    tags = ["phase4", "intent_taxonomy", cat.lower(), code.lower()]
    name = row.get("intent_name") or code
    title = f"{code} — {name}"

    return {
        "id": f"phase4-{code}",
        "title": title,
        "content": build_content(row),
        "segment": SEGMENT,
        "language": ["english", "nepali", "romanized"],
        "tags": tags,
        "source": SOURCE,
        "intent_code": code,
        "intent_name": name,
        "intent_category": cat,
        "required_fields": row.get("required_fields") or [],
        "journal_entry_rule": row.get("journal_entry_rule") or "",
        "inventory_rule": row.get("inventory_rule") or "",
        "tax_rule_placeholder": row.get("tax_rule_placeholder") or "",
    }


def load_raw_rows(raw_path: Path) -> list[dict]:
    rows: list[dict] = []
    for i, line in enumerate(raw_path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as exc:
            print(f"Skip bad line {i}: {exc}")
    return rows


def ingest(raw_path: Path) -> int:
    rows = load_raw_rows(raw_path)
    chunks = [row_to_chunk(r) for r in rows if r.get("intent_code")]
    out_path = ROOT / OUT_REL
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    print(f"Wrote {len(chunks)} → {out_path.relative_to(ROOT)}")
    by_cat: dict[str, int] = {}
    for c in chunks:
        cat = c["intent_category"]
        by_cat[cat] = by_cat.get(cat, 0) + 1
    print("By category:", dict(sorted(by_cat.items())))
    return len(chunks)


def main() -> None:
    raw = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else ROOT / "data/ekhata/knowledge/_ingest/phase4_intent_taxonomy_raw.jsonl"
    )
    if not raw.exists():
        print(f"Missing raw file: {raw}")
        sys.exit(1)
    count = ingest(raw)

    sys.path.insert(0, str(ROOT / "erp_bot"))
    from src.knowledge.knowledge_registry import load_all_chunks, search_tiered_knowledge

    total = len(load_all_chunks(force_reload=True))
    print("KB total chunks after reload:", total)
    hits = search_tiered_knowledge("cash sale bikri cash ma", task="nlu", top_k=2)
    if hits:
        print("Sample search top hit:", hits[0].id, hits[0].segment)
    print("Phase 4 intents ingested:", count)


if __name__ == "__main__":
    main()
