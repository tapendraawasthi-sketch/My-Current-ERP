#!/usr/bin/env python3
"""Ingest Nepal Universal AI ontology JSONL into e-Khata knowledge chunks."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ONTOLOGY_DIR = ROOT / "data" / "nepal-ai" / "ontology"
OUTPUT_DIR = ROOT / "data" / "ekhata" / "knowledge" / "general" / "ontology"
MANIFEST_PATH = ROOT / "data" / "nepal-ai" / "collection_manifest.json"

# Map ontology sector ids → existing e-Khata KB slugs where they exist
EXISTING_SLUG_MAP: dict[str, str] = {
    "sector-001": "kirana-grocery",
    "sector-002": "hardware-shop",
    "sector-003": "electronics-mobile-shop",
    "sector-006": "pharmacy-medical",
    "sector-008": "restaurant-cafe",
    "sector-010": "bakery",
    "sector-011": "meat-shop",
    "sector-012": "dairy-shop",
    "sector-013": "fruit-vegetable-shop",
    "sector-015": "hardware-construction-materials-shop",
    "sector-024": "clinic-health",
    "sector-049": "software-it-firm",
}


def slugify(name_en: str, sector_id: str) -> str:
    if sector_id in EXISTING_SLUG_MAP:
        return EXISTING_SLUG_MAP[sector_id]
    base = re.sub(r"[^a-z0-9]+", "-", name_en.lower()).strip("-")
    return base[:48] or sector_id.replace("sector-", "sector-")


def load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def sector_to_chunk(row: dict) -> dict:
    sector_id = row["id"]
    slug = slugify(row.get("name_en", ""), sector_id)
    roles = ", ".join(row.get("typical_roles") or [])
    txns = "; ".join(row.get("common_transactions") or [])
    phrases = "; ".join(row.get("example_user_phrases") or [])
    content = (
        f"Macro sector: {row.get('macro_sector')} / {row.get('subsector')}\n"
        f"English: {row.get('name_en')}\n"
        f"Nepali: {row.get('name_ne_roman')} ({row.get('name_ne_devanagari', '')})\n"
        f"Typical roles: {roles}\n"
        f"Common transactions: {txns}\n"
        f"How users speak: {phrases}"
    )
    return {
        "id": f"ontology-{sector_id}",
        "segment": "general.ontology.sectors",
        "title": row.get("name_en", ""),
        "content": content,
        "language": ["nepali", "english", "romanized"],
        "tags": list(row.get("tags") or []) + [slug, row.get("macro_sector", "").lower()],
        "source": "Nepal Universal AI Ontology BATCH 01",
        "metadata": {
            "sector_id": sector_id,
            "sector_slug": slug,
            "macro_sector": row.get("macro_sector"),
            "subsector": row.get("subsector"),
            "name_ne_roman": row.get("name_ne_roman"),
            "name_ne_devanagari": row.get("name_ne_devanagari"),
            "example_user_phrases": row.get("example_user_phrases") or [],
            "kb_slug": slug,
        },
    }


def phrase_to_router_row(row: dict, phrase: str, idx: int) -> dict:
    sector_id = row["id"]
    slug = slugify(row.get("name_en", ""), sector_id)
    return {
        "id": f"router-{sector_id}-{idx:02d}",
        "segment": "general.ontology.router",
        "title": f"Sector phrase: {slug}",
        "content": phrase,
        "language": ["romanized", "nepali"],
        "tags": ["sector_phrase", slug, row.get("macro_sector", "").lower()],
        "source": "Nepal Universal AI Ontology BATCH 01",
        "metadata": {
            "input": phrase,
            "sector_id": sector_id,
            "sector_slug": slug,
            "domain_hint": "sector_context",
            "macro_sector": row.get("macro_sector"),
        },
    }


def keyword_entry(row: dict) -> dict:
    sector_id = row["id"]
    slug = slugify(row.get("name_en", ""), sector_id)
    keywords: list[str] = []
    for field in ("name_en", "name_ne_roman", "subsector", "macro_sector"):
        val = row.get(field)
        if val:
            keywords.extend(re.findall(r"[a-zA-Z\u0900-\u097F]+", str(val)))
    for tag in row.get("tags") or []:
        keywords.append(str(tag))
    for phrase in row.get("example_user_phrases") or []:
        keywords.extend(w for w in phrase.lower().split() if len(w) > 2)
    unique = sorted({k.lower() for k in keywords if k and len(k) > 2})[:40]
    return {
        "sector_id": sector_id,
        "sector_slug": slug,
        "name_en": row.get("name_en"),
        "name_ne_roman": row.get("name_ne_roman"),
        "macro_sector": row.get("macro_sector"),
        "keywords": unique,
    }


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def update_manifest(sector_count: int, phrase_count: int) -> None:
    manifest: dict = {"batches": {}, "totals": {}}
    if MANIFEST_PATH.exists():
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    manifest.setdefault("batches", {})["01_master_sectors"] = {
        "status": "ingested",
        "source": "data/nepal-ai/ontology/master_sectors.jsonl",
        "sectors": sector_count,
        "router_phrases": phrase_count,
    }
    totals = manifest.setdefault("totals", {})
    totals["sectors"] = sector_count
    totals["router_phrases"] = phrase_count
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    source = ONTOLOGY_DIR / "master_sectors.jsonl"
    if not source.exists():
        print(f"Missing {source}", file=sys.stderr)
        return 1

    rows = load_jsonl(source)
    sector_chunks = [sector_to_chunk(r) for r in rows]
    router_chunks: list[dict] = []
    for r in rows:
        for i, phrase in enumerate(r.get("example_user_phrases") or [], start=1):
            router_chunks.append(phrase_to_router_row(r, phrase, i))
    keywords = [keyword_entry(r) for r in rows]

    write_jsonl(OUTPUT_DIR / "sectors.jsonl", sector_chunks)
    write_jsonl(OUTPUT_DIR / "sector_router_phrases.jsonl", router_chunks)
    write_jsonl(ONTOLOGY_DIR / "sector_keywords.jsonl", keywords)

    update_manifest(len(sector_chunks), len(router_chunks))
    print(f"Ingested {len(sector_chunks)} sectors, {len(router_chunks)} router phrases")
    print(f"Output: {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
