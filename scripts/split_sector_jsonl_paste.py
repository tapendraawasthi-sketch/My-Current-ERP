#!/usr/bin/env python3
"""Split a pasted JSONL block (one JSON object per line) into sector_*_batchN.jsonl files."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INGEST = ROOT / "data" / "ekhata" / "knowledge" / "_ingest"


def slug_for_sector(sector: str) -> str:
    mapping = {
        "Bakery": "bakery",
        "Dairy Shop": "dairy-shop",
        "Meat shop": "meat-shop",
        "Fruit and vegetable shop": "fruit-vegetable-shop",
        "Hardware shop": "hardware-shop",
        "Construction Material Supplier": "construction-material-supplier",
        "Cement & Rod Retail Shop": "cement-rod-retail-shop",
        "Restaurant/cafe": "restaurant-cafe",
        "Clinic/health service": "clinic-health",
    }
    return mapping.get(sector) or sector.lower().replace("/", "-").replace(" ", "-")


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if not src or not src.exists():
        print("Usage: split_sector_jsonl_paste.py <paste.jsonl>")
        sys.exit(1)
    rows: list[dict] = []
    for line in src.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("```"):
            continue
        if line.startswith("Copy{"):
            line = line[4:]
        if not line.startswith("{"):
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as e:
            print(f"Skip bad line: {e}")
    by_sector: dict[str, list[dict]] = {}
    for row in rows:
        sector = str(row.get("sector") or "")
        by_sector.setdefault(sector, []).append(row)
    for sector, sector_rows in by_sector.items():
        slug = slug_for_sector(sector)
        for i in range(0, len(sector_rows), 100):
            chunk = sector_rows[i : i + 100]
            batch = i // 100 + 1
            out = INGEST / f"sector_{slug}_batch{batch}.jsonl"
            with out.open("w", encoding="utf-8") as f:
                for row in chunk:
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")
            print(f"Wrote {len(chunk)} -> {out.name}")
    print("Total rows:", len(rows), "sectors:", {k: len(v) for k, v in by_sector.items()})


if __name__ == "__main__":
    main()
