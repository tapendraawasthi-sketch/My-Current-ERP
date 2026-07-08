#!/usr/bin/env python3
"""Ingest Nepal Universal AI particle/postposition maps into e-Khata knowledge."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANG_DIR = ROOT / "data" / "nepal-ai" / "language"
OUTPUT_DIR = ROOT / "data" / "ekhata" / "knowledge" / "general" / "language" / "particles"
MANIFEST_PATH = ROOT / "data" / "nepal-ai" / "collection_manifest.json"

DIRECTION_TO_INTENT: dict[str, str] = {
    "OUTBOUND": "khata_payment_out",
    "INBOUND_SOURCE": "khata_payment_in",
    "AGENT_IDENTIFIER": "khata_journal",
    "BILATERAL_OR_HOLDER": "khata_journal",
    "OWNERSHIP_SCOPE": "khata_journal",
    "LOCATION_OR_TARGET": "khata_journal",
    "TEMPORAL_RANGE_START": "query",
    "TEMPORAL_OR_AMOUNT_CEILING": "query",
    "PURPOSE_OR_BENEFICIARY": "khata_journal",
    "UNIT_RATE_OR_FORMAL_ADDRESSEE": "khata_journal",
    "ABSENT_ELEMENT": "khata_journal",
    "EXCLUSION": "khata_journal",
    "COMPARATIVE_THRESHOLD": "query",
    "APPROXIMATION": "khata_journal",
    "TEMPORAL_AFTER": "khata_journal",
    "TEMPORAL_BEFORE_OR_ADVANCE": "khata_payment_out",
    "ABOVE_THRESHOLD_OR_ADDITIONAL": "query",
    "BELOW_THRESHOLD": "query",
    "WITHIN_SCOPE_OR_DEADLINE": "khata_journal",
    "OUTSIDE_SCOPE_OR_ZONE": "khata_journal",
    "LOCATION_PROXIMITY": "khata_journal",
    "DISTANCE_OR_REMOTE": "khata_journal",
    "INTER_PARTY_OR_RANGE": "query",
    "OWN_SIDE_DOMESTIC": "khata_journal",
    "COUNTERPARTY_OR_CROSS_BORDER": "khata_payment_in",
    "APPROXIMATE_DIRECTION": "khata_journal",
    "PROXIMITY_OR_APPROACHING_DEADLINE": "khata_journal",
    "UNDER_CATEGORY_OR_AUTHORITY": "khata_journal",
    "ADDITIONAL_CHARGE_ON_BASE": "khata_journal",
    "PRIOR_HISTORICAL_REFERENCE": "query",
}


def load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def particle_to_chunk(row: dict) -> dict:
    particle = row["particle"]
    variants = row.get("romanization_variants") or []
    rules = row.get("disambiguation_rules") or []
    confusions = row.get("common_confusions") or []
    patterns = row.get("example_patterns") or []
    pattern_text = "\n".join(
        f"- {p.get('pattern', '')} → {p.get('meaning', '')} [{p.get('transaction', '')}]"
        for p in patterns
    )

    content = (
        f"Particle: {particle} ({row.get('devanagari', '')})\n"
        f"Role: {row.get('grammatical_role', '')}\n"
        f"Transaction direction: {row.get('transaction_direction', '')}\n"
        f"Direction vector: {row.get('direction_vector', '')}\n"
        f"Signal strength: {row.get('transaction_signal_strength', '')}\n"
        f"Variants: {', '.join(variants)}\n"
        f"Disambiguation:\n" + "\n".join(f"  • {r}" for r in rules) + "\n"
        f"Confusions:\n" + "\n".join(f"  • {c}" for c in confusions) + "\n"
        f"Patterns:\n{pattern_text}"
    )

    direction = row.get("direction_vector", "")
    return {
        "id": f"particle-{particle}",
        "segment": "general.language.particles",
        "title": f"Particle: {particle}",
        "content": content,
        "language": ["nepali", "romanized", "english"],
        "tags": ["particle", particle, direction.lower() if direction else "particle"],
        "source": "Nepal Universal AI BATCH 04",
        "metadata": {
            "particle": particle,
            "devanagari": row.get("devanagari"),
            "grammatical_role": row.get("grammatical_role"),
            "transaction_direction": row.get("transaction_direction"),
            "direction_vector": direction,
            "transaction_signal_strength": row.get("transaction_signal_strength"),
            "intent_hint": DIRECTION_TO_INTENT.get(direction, "khata_journal"),
            "romanization_variants": variants,
            "example_patterns": patterns,
            "disambiguation_rules": rules,
            "common_confusions": confusions,
        },
    }


def pattern_to_nlu_row(row: dict, pattern: dict, idx: int) -> dict:
    particle = row["particle"]
    text = pattern.get("pattern", "")
    direction = row.get("direction_vector", "")
    return {
        "id": f"nlu-particle-{particle}-{idx:02d}",
        "segment": "general.language.particles",
        "title": f"Particle pattern: {particle}",
        "content": text,
        "language": ["romanized", "nepali"],
        "tags": ["particle_pattern", particle, pattern.get("transaction", "")],
        "source": "Nepal Universal AI BATCH 04",
        "metadata": {
            "input": text,
            "particle": particle,
            "meaning": pattern.get("meaning", ""),
            "transaction": pattern.get("transaction", ""),
            "direction_vector": direction,
            "intent_hint": DIRECTION_TO_INTENT.get(direction, "khata_journal"),
            "domain_hint": "journal_entry",
        },
    }


def build_particle_map(rows: list[dict]) -> dict[str, dict]:
    mapping: dict[str, dict] = {}
    for row in rows:
        particle = row["particle"]
        direction = row.get("direction_vector", "")
        entry = {
            "particle": particle,
            "direction_vector": direction,
            "transaction_direction": row.get("transaction_direction"),
            "intent_hint": DIRECTION_TO_INTENT.get(direction, "khata_journal"),
            "signal_strength": row.get("transaction_signal_strength"),
        }
        forms = {particle.lower()}
        for v in row.get("romanization_variants") or []:
            forms.add(v.lower().strip())
        for form in forms:
            if form and len(form) > 0:
                mapping[form] = entry
    return mapping


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def update_manifest(particle_count: int, pattern_count: int, map_count: int) -> None:
    manifest: dict = {"batches": {}, "totals": {}}
    if MANIFEST_PATH.exists():
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    manifest.setdefault("batches", {})["04_particles"] = {
        "status": "ingested",
        "source": "data/nepal-ai/language/particles.jsonl",
        "particles": particle_count,
        "patterns": pattern_count,
        "normalize_entries": map_count,
    }

    totals = manifest.setdefault("totals", {})
    totals["particles"] = particle_count
    totals["particle_patterns"] = pattern_count
    totals["particle_normalize_entries"] = map_count
    totals["batches_complete"] = sum(
        1 for b in manifest.get("batches", {}).values() if b.get("status") == "ingested"
    )
    totals["batches_pending"] = 40 - totals["batches_complete"]
    manifest["next_batch"] = "05_numbers_amounts"
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    source = LANG_DIR / "particles.jsonl"
    if not source.exists():
        print(f"Missing {source}", file=sys.stderr)
        return 1

    rows = load_jsonl(source)
    chunks = [particle_to_chunk(r) for r in rows]
    pattern_chunks: list[dict] = []
    for r in rows:
        for i, pat in enumerate(r.get("example_patterns") or [], start=1):
            pattern_chunks.append(pattern_to_nlu_row(r, pat, i))

    particle_map = build_particle_map(rows)

    write_jsonl(OUTPUT_DIR / "particles.jsonl", chunks)
    write_jsonl(OUTPUT_DIR / "particle_patterns.jsonl", pattern_chunks)
    LANG_DIR.joinpath("particle_direction_map.json").write_text(
        json.dumps(particle_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    update_manifest(len(chunks), len(pattern_chunks), len(particle_map))
    print(
        f"Ingested {len(chunks)} particles, {len(pattern_chunks)} patterns, "
        f"{len(particle_map)} direction map entries"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
