#!/usr/bin/env python3
"""Ingest Nepal Universal AI batches 20–40 into e-Khata knowledge."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NEPAL_AI = ROOT / "data" / "nepal-ai"
KB = ROOT / "data" / "ekhata" / "knowledge" / "general"
MANIFEST_PATH = NEPAL_AI / "collection_manifest.json"

BATCHES: list[dict] = [
    {
        "key": "20_polysemy",
        "source": NEPAL_AI / "language" / "polysemy.jsonl",
        "segment": "general.language.polysemy",
        "kb_out": KB / "language" / "polysemy" / "polysemy.jsonl",
        "id_field": "word",
        "title_prefix": "Polysemy",
        "count_key": "entries",
        "next": "21_tax_vocabulary",
    },
    {
        "key": "21_tax_vocabulary",
        "source": NEPAL_AI / "regulated" / "tax_vocabulary.jsonl",
        "segment": "general.regulated.tax",
        "kb_out": KB / "regulated" / "tax" / "tax_vocabulary.jsonl",
        "id_field": "term",
        "title_prefix": "Tax term",
        "count_key": "terms",
        "next": "22_legal_vocabulary",
    },
    {
        "key": "22_legal_vocabulary",
        "source": NEPAL_AI / "regulated" / "legal_vocabulary.jsonl",
        "segment": "general.regulated.legal",
        "kb_out": KB / "regulated" / "legal" / "legal_vocabulary.jsonl",
        "id_field": "term",
        "title_prefix": "Legal term",
        "count_key": "terms",
        "next": "23_labor_ssf",
    },
    {
        "key": "23_labor_ssf",
        "source": NEPAL_AI / "regulated" / "labor_ssf.jsonl",
        "segment": "general.regulated.labor",
        "kb_out": KB / "regulated" / "labor" / "labor_ssf.jsonl",
        "id_field": "term",
        "title_prefix": "Labor term",
        "count_key": "terms",
        "next": "24_banking_finance",
    },
    {
        "key": "24_banking_finance",
        "source": NEPAL_AI / "regulated" / "banking_finance.jsonl",
        "segment": "general.regulated.banking",
        "kb_out": KB / "regulated" / "banking" / "banking_finance.jsonl",
        "id_field": "term",
        "title_prefix": "Banking term",
        "count_key": "terms",
        "next": "25_government_services",
    },
    {
        "key": "25_government_services",
        "source": NEPAL_AI / "regulated" / "government_services.jsonl",
        "segment": "general.regulated.government",
        "kb_out": KB / "regulated" / "government" / "government_services.jsonl",
        "id_field": "term",
        "title_prefix": "Gov service",
        "count_key": "terms",
        "next": "26_accounting_concepts",
    },
    {
        "key": "26_accounting_concepts",
        "source": NEPAL_AI / "knowledge" / "accounting_concepts.jsonl",
        "segment": "general.knowledge.accounting",
        "kb_out": KB / "knowledge" / "accounting" / "accounting_concepts.jsonl",
        "id_field": "concept",
        "title_prefix": "Accounting",
        "count_key": "concepts",
        "next": "27_typos_variants",
    },
    {
        "key": "27_typos_variants",
        "source": NEPAL_AI / "language" / "typos_variants.jsonl",
        "segment": "general.language.typos",
        "kb_out": KB / "language" / "typos" / "typos_variants.jsonl",
        "id_field": "correct",
        "title_prefix": "Typo map",
        "count_key": "variants",
        "map_out": NEPAL_AI / "language" / "typo_normalize_map.json",
        "next": "28_multiturn_patterns",
    },
    {
        "key": "28_multiturn_patterns",
        "source": NEPAL_AI / "behavior" / "multiturn_patterns.jsonl",
        "segment": "general.behavior.multiturn",
        "kb_out": KB / "behavior" / "multiturn" / "multiturn_patterns.jsonl",
        "id_field": "chain_id",
        "title_prefix": "Multiturn",
        "count_key": "chains",
        "next": "29_clarify_templates",
    },
    {
        "key": "29_clarify_templates",
        "source": NEPAL_AI / "behavior" / "clarify_templates.jsonl",
        "segment": "general.behavior.clarify",
        "kb_out": KB / "behavior" / "clarify" / "clarify_templates.jsonl",
        "id_field": "scenario",
        "title_prefix": "Clarify",
        "count_key": "templates",
        "map_out": NEPAL_AI / "behavior" / "clarify_template_map.json",
        "next": "30_router_training",
    },
    {
        "key": "30_router_training",
        "source": NEPAL_AI / "behavior" / "router_training.jsonl",
        "segment": "general.behavior.router",
        "kb_out": KB / "behavior" / "router" / "router_training.jsonl",
        "id_field": "input",
        "title_prefix": "Router",
        "count_key": "examples",
        "next": "31_entity_extraction",
    },
    {
        "key": "31_entity_extraction",
        "source": NEPAL_AI / "behavior" / "entity_extraction.jsonl",
        "segment": "general.behavior.entities",
        "kb_out": KB / "behavior" / "entities" / "entity_extraction.jsonl",
        "id_field": "input",
        "title_prefix": "Entity NER",
        "count_key": "examples",
        "next": "32_safety_refusals",
    },
    {
        "key": "32_safety_refusals",
        "source": NEPAL_AI / "behavior" / "safety_refusals.jsonl",
        "segment": "general.behavior.safety",
        "kb_out": KB / "behavior" / "safety" / "safety_refusals.jsonl",
        "id_field": "input_pattern",
        "title_prefix": "Safety",
        "count_key": "patterns",
        "map_out": NEPAL_AI / "behavior" / "safety_pattern_map.json",
        "next": "33_golden_core",
    },
    {
        "key": "33_golden_core",
        "source": NEPAL_AI / "eval" / "golden_core.jsonl",
        "segment": "general.eval.golden_core",
        "kb_out": KB / "eval" / "golden_core.jsonl",
        "id_field": "id",
        "title_prefix": "Golden",
        "count_key": "cases",
        "eval_only": True,
        "next": "34_golden_edge",
    },
    {
        "key": "34_golden_edge",
        "source": NEPAL_AI / "eval" / "golden_edge.jsonl",
        "segment": "general.eval.golden_edge",
        "kb_out": KB / "eval" / "golden_edge.jsonl",
        "id_field": "id",
        "title_prefix": "Edge",
        "count_key": "cases",
        "eval_only": True,
        "next": "35_proverbs_idioms",
    },
    {
        "key": "35_proverbs_idioms",
        "source": NEPAL_AI / "language" / "proverbs_idioms.jsonl",
        "segment": "general.language.proverbs",
        "kb_out": KB / "language" / "proverbs" / "proverbs_idioms.jsonl",
        "id_field": "proverb_roman",
        "title_prefix": "Proverb",
        "count_key": "proverbs",
        "next": "36_nepal_geography",
    },
    {
        "key": "36_nepal_geography",
        "source": NEPAL_AI / "knowledge" / "nepal_geography.jsonl",
        "segment": "general.knowledge.geography",
        "kb_out": KB / "knowledge" / "geography" / "nepal_geography.jsonl",
        "id_field": "name_en",
        "title_prefix": "Geography",
        "count_key": "entries",
        "next": "37_festivals_holidays",
    },
    {
        "key": "37_festivals_holidays",
        "source": NEPAL_AI / "knowledge" / "festivals_holidays.jsonl",
        "segment": "general.knowledge.festivals",
        "kb_out": KB / "knowledge" / "festivals" / "festivals_holidays.jsonl",
        "id_field": "festival",
        "title_prefix": "Festival",
        "count_key": "festivals",
        "next": "38_food_menu",
    },
    {
        "key": "38_food_menu",
        "source": NEPAL_AI / "knowledge" / "food_menu.jsonl",
        "segment": "general.knowledge.food",
        "kb_out": KB / "knowledge" / "food" / "food_menu.jsonl",
        "id_field": "item",
        "title_prefix": "Food item",
        "count_key": "items",
        "next": "39_construction_materials",
    },
    {
        "key": "39_construction_materials",
        "source": NEPAL_AI / "knowledge" / "construction_materials.jsonl",
        "segment": "general.knowledge.construction",
        "kb_out": KB / "knowledge" / "construction" / "construction_materials.jsonl",
        "id_field": "item",
        "title_prefix": "Material",
        "count_key": "materials",
        "next": "40_intent_taxonomy",
    },
    {
        "key": "40_intent_taxonomy",
        "source": NEPAL_AI / "ontology" / "intent_taxonomy.jsonl",
        "segment": "general.ontology.intents",
        "kb_out": KB / "ontology" / "intent_taxonomy.jsonl",
        "id_field": "intent",
        "title_prefix": "Intent",
        "count_key": "intents",
        "map_out": NEPAL_AI / "ontology" / "intent_taxonomy_map.json",
        "next": "complete",
    },
]


def load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("Copy"):
            rows.append(json.loads(line))
    return rows


def slug(value: str) -> str:
    return (
        str(value)
        .lower()
        .replace(" ", "-")
        .replace("/", "-")
        .replace("%", "pct")
        .replace("?", "q")
        [:64]
    )


def row_to_chunk(batch: dict, row: dict, idx: int) -> dict:
    field = batch["id_field"]
    title_val = row.get(field) or row.get("input") or f"item-{idx}"
    content = "\n".join(f"{k}: {json.dumps(v, ensure_ascii=False)}" for k, v in row.items())
    return {
        "id": f"{batch['key'].split('_', 1)[-1]}-{slug(str(title_val))}-{idx:03d}",
        "segment": batch["segment"],
        "title": f"{batch['title_prefix']}: {title_val}",
        "content": content,
        "language": ["nepali", "romanized", "english"],
        "tags": [batch["key"], batch["segment"].split(".")[-1]],
        "source": f"Nepal Universal AI BATCH {batch['key'].split('_')[0]}",
        "metadata": row,
    }


def build_typo_map(rows: list[dict]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for row in rows:
        correct = str(row.get("correct") or "").lower().strip()
        if correct:
            mapping[correct] = correct
            for variant in row.get("variants") or []:
                v = str(variant).lower().strip()
                if v:
                    mapping[v] = correct
    return mapping


def build_clarify_map(rows: list[dict]) -> dict[str, dict]:
    mapping: dict[str, dict] = {}
    for i, row in enumerate(rows, start=1):
        scenario = str(row.get("scenario") or f"s-{i}")
        base = scenario.split("_v")[0] if "_v" in scenario else scenario
        key = base if base not in mapping else scenario
        if key in mapping:
            continue
        mapping[key] = {
            "template_ne": row.get("template_ne"),
            "template_en": row.get("template_en"),
            "example_trigger": row.get("example_trigger"),
            "example_response": row.get("example_response"),
        }
    return mapping


def build_safety_map(rows: list[dict]) -> dict[str, dict]:
    mapping: dict[str, dict] = {}
    for row in rows:
        pattern = str(row.get("input_pattern") or "").lower()
        if pattern:
            mapping[pattern] = {
                "category": row.get("category"),
                "action": row.get("action"),
                "response_ne": row.get("response_ne"),
                "response_en": row.get("response_en"),
                "risk_level": row.get("risk_level"),
            }
    return mapping


def build_intent_map(rows: list[dict]) -> dict[str, dict]:
    return {
        str(row.get("intent") or f"intent-{i}"): row
        for i, row in enumerate(rows, start=1)
        if row.get("intent")
    }


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def ingest_one(batch: dict) -> dict | None:
    source = batch["source"]
    if not source.exists():
        print(f"Skip missing {source}", file=sys.stderr)
        return None

    rows = load_jsonl(source)
    if batch.get("eval_only"):
        write_jsonl(batch["kb_out"], rows)
        map_entries = 0
    else:
        chunks = [row_to_chunk(batch, r, i) for i, r in enumerate(rows, start=1)]
        write_jsonl(batch["kb_out"], chunks)
        map_entries = 0

        if batch.get("map_out") and batch["key"] == "27_typos_variants":
            typo_map = build_typo_map(rows)
            batch["map_out"].write_text(
                json.dumps(typo_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
            map_entries = len(typo_map)
        elif batch.get("map_out") and batch["key"] == "29_clarify_templates":
            cmap = build_clarify_map(rows)
            batch["map_out"].write_text(json.dumps(cmap, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            map_entries = len(cmap)
        elif batch.get("map_out") and batch["key"] == "32_safety_refusals":
            smap = build_safety_map(rows)
            batch["map_out"].write_text(json.dumps(smap, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            map_entries = len(smap)
        elif batch.get("map_out") and batch["key"] == "40_intent_taxonomy":
            imap = build_intent_map(rows)
            batch["map_out"].write_text(json.dumps(imap, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            map_entries = len(imap)

    return {
        "key": batch["key"],
        "source": str(source.relative_to(ROOT)),
        "count_key": batch["count_key"],
        "count": len(rows),
        "map_entries": map_entries,
        "next": batch["next"],
    }


def update_manifest(results: list[dict]) -> None:
    manifest: dict = {"batches": {}, "totals": {}}
    if MANIFEST_PATH.exists():
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    for info in results:
        entry = {
            "status": "ingested",
            "source": info["source"],
            info["count_key"]: info["count"],
        }
        if info.get("map_entries"):
            entry["normalize_entries"] = info["map_entries"]
        manifest.setdefault("batches", {})[info["key"]] = entry

    totals = manifest.setdefault("totals", {})
    totals["batches_complete"] = sum(
        1 for b in manifest.get("batches", {}).values() if b.get("status") == "ingested"
    )
    totals["batches_pending"] = max(0, 40 - totals["batches_complete"])
    manifest["next_batch"] = results[-1]["next"] if results else "complete"
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    keys = sys.argv[1:] if len(sys.argv) > 1 else [b["key"] for b in BATCHES]
    key_set = set(keys)
    results: list[dict] = []
    for batch in BATCHES:
        if batch["key"] not in key_set and len(sys.argv) > 1:
            continue
        info = ingest_one(batch)
        if info:
            results.append(info)
            extra = f", {info['map_entries']} map entries" if info.get("map_entries") else ""
            print(f"{info['key']}: {info['count']} rows{extra}")

    if not results:
        return 1
    update_manifest(results)
    print(f"Updated manifest; next_batch={results[-1]['next']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
