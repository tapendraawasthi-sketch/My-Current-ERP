#!/usr/bin/env python3
"""Regenerate Nepal SME COA alias JSONL with aliases_flat for NLU lookup."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data/ekhata/knowledge/professional/sector/coa/nepal-sme-coa-aliases.jsonl"
SOURCE = "Nepal SME Master COA Phase 2 (AI Training — verify tax with IRD/CA)"

# Full alias dataset (Phase 2) — abbreviated keys preserved for lookup
ROWS: list[dict] = []  # populated below via load from existing file + merge

def build_content(row: dict) -> str:
    parts = [
        f"COA {row['account_id']} — {row['account_name_en']} | {row['account_type']} | Normal {row['normal_balance']}",
        f"Nepali: {row.get('account_name_np', '')} | Roman: {row.get('account_name_romanized', '')}",
    ]
    for key in (
        "aliases_english",
        "aliases_romanized",
        "aliases_nepali",
        "aliases_misspelled_slang",
        "shopkeeper_phrases",
    ):
        vals = row.get(key) or []
        if vals:
            parts.append(f"{key}: {', '.join(vals)}")
    return "\n".join(parts)


def flatten_aliases(row: dict) -> list[str]:
    flat: list[str] = []
    for key in (
        "aliases_english",
        "aliases_romanized",
        "aliases_nepali",
        "aliases_misspelled_slang",
        "shopkeeper_phrases",
    ):
        for a in row.get(key) or []:
            a = a.lower().strip()
            if len(a) >= 2:
                flat.append(a)
    name = (row.get("account_name_en") or "").lower()
    if name:
        flat.append(name)
    return list(dict.fromkeys(flat))


def main() -> None:
    raw_path = ROOT / "data/ekhata/knowledge/professional/sector/coa/_aliases_raw.jsonl"
    if not raw_path.exists():
        print("Missing _aliases_raw.jsonl — run from existing nepal-sme-coa-aliases content only")
        return
    chunks = []
    for line in raw_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        aid = row["account_id"]
        flat = flatten_aliases(row)
        chunks.append(
            {
                "id": f"coa-{aid}",
                "title": f"{aid} {row['account_name_en']}",
                "content": build_content(row),
                "segment": "professional.sector.coa",
                "language": ["nepali", "english", "romanized"],
                "tags": ["coa", "alias", row["account_type"].lower(), aid],
                "source": SOURCE,
                "account_id": aid,
                "account_type": row["account_type"],
                "normal_balance": row["normal_balance"],
                "account_name_en": row["account_name_en"],
                "account_name_np": row.get("account_name_np", ""),
                "account_name_romanized": row.get("account_name_romanized", ""),
                "aliases_flat": flat,
            }
        )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    print(f"Wrote {len(chunks)} alias chunks")


if __name__ == "__main__":
    main()
