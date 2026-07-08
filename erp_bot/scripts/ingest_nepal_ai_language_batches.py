#!/usr/bin/env python3
"""Ingest Nepal Universal AI language batches 05–10 into e-Khata knowledge + maps."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANG_DIR = ROOT / "data" / "nepal-ai" / "language"
KB_LANG = ROOT / "data" / "ekhata" / "knowledge" / "general" / "language"
MANIFEST_PATH = ROOT / "data" / "nepal-ai" / "collection_manifest.json"

BATCHES = [
    {
        "key": "05_numbers_amounts",
        "source": "numbers_amounts.jsonl",
        "segment": "general.language.numbers",
        "kb_subdir": "numbers",
        "id_field": "canonical_form",
        "title_prefix": "Amount",
        "next": "06_profit_loss_vocab",
        "count_key": "patterns",
    },
    {
        "key": "06_profit_loss_vocab",
        "source": "profit_loss_vocab.jsonl",
        "segment": "general.language.profit_loss",
        "kb_subdir": "profit_loss",
        "id_field": "term_roman",
        "title_prefix": "P/L term",
        "next": "07_credit_debt_vocab",
        "count_key": "terms",
    },
    {
        "key": "07_credit_debt_vocab",
        "source": "credit_debt_vocab.jsonl",
        "segment": "general.language.credit_debt",
        "kb_subdir": "credit_debt",
        "id_field": "term_roman",
        "title_prefix": "Credit/debt",
        "next": "08_question_patterns",
        "count_key": "terms",
    },
    {
        "key": "08_question_patterns",
        "source": "question_patterns.jsonl",
        "segment": "general.language.questions",
        "kb_subdir": "questions",
        "id_field": "pattern",
        "title_prefix": "Question",
        "next": "09_affirmation_negation",
        "count_key": "patterns",
    },
    {
        "key": "09_affirmation_negation",
        "source": "affirmation_negation.jsonl",
        "segment": "general.language.discourse",
        "kb_subdir": "discourse",
        "id_field": "pattern",
        "title_prefix": "Discourse",
        "next": "10_time_date",
        "count_key": "patterns",
    },
    {
        "key": "10_time_date",
        "source": "time_date.jsonl",
        "segment": "general.language.time",
        "kb_subdir": "time",
        "id_field": "pattern_type",
        "title_prefix": "Time/date",
        "next": "11_retail_kirana",
        "count_key": "patterns",
        "id_extra": "terms",
    },
]


def load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def slug(value: str) -> str:
    return (
        value.lower()
        .replace(" ", "-")
        .replace("/", "-")
        .replace("%", "pct")
        .replace("?", "q")
        .replace("…", "")
        .replace(".", "")
        [:64]
    )


def row_id(batch: dict, row: dict, idx: int) -> str:
    field = batch["id_field"]
    base = str(row.get(field) or f"row-{idx}")
    if batch.get("id_extra") and row.get(batch["id_extra"]):
        extra = row[batch["id_extra"]]
        if isinstance(extra, list) and extra:
            base = f"{base}-{extra[0]}"
    return f"{batch['kb_subdir']}-{slug(base)}-{idx:02d}"


def row_to_chunk(batch: dict, row: dict, idx: int) -> dict:
    title_key = batch["id_field"]
    title_val = row.get(title_key) or f"item-{idx}"
    content_parts = [f"{k}: {json.dumps(v, ensure_ascii=False)}" for k, v in row.items()]
    return {
        "id": row_id(batch, row, idx),
        "segment": batch["segment"],
        "title": f"{batch['title_prefix']}: {title_val}",
        "content": "\n".join(content_parts),
        "language": ["nepali", "romanized", "english"],
        "tags": [batch["kb_subdir"], str(row.get("pattern_type") or row.get("type") or row.get("accounting_class") or "language").lower()],
        "source": f"Nepal Universal AI BATCH {batch['key'][:2]}",
        "metadata": row,
    }


def build_number_map(rows: list[dict]) -> dict[str, dict]:
    mapping: dict[str, dict] = {}
    for row in rows:
        entry = {
            "canonical_form": row.get("canonical_form"),
            "numeric_value": row.get("numeric_value"),
            "pattern_type": row.get("pattern_type"),
            "regex_hint": row.get("regex_hint"),
        }
        for key in ("examples", "common_typos", "usage_examples"):
            for form in row.get(key) or []:
                f = str(form).lower().strip()
                if f and len(f) > 0:
                    mapping[f] = entry
        canon = str(row.get("canonical_form") or "").lower()
        if canon:
            mapping[canon] = entry
    return mapping


def build_pl_map(rows: list[dict]) -> dict[str, dict]:
    mapping: dict[str, dict] = {}
    for row in rows:
        entry = {
            "term_roman": row.get("term_roman"),
            "accounting_class": row.get("accounting_class"),
            "journal_intent_if_entry": row.get("journal_intent_if_entry"),
            "meaning_en": row.get("meaning_en"),
        }
        forms = {str(row.get("term_roman") or "").lower()}
        for v in row.get("variants") or []:
            forms.add(str(v).lower().strip())
        for form in forms:
            if form:
                mapping[form] = entry
    return mapping


def build_credit_map(rows: list[dict]) -> dict[str, dict]:
    mapping: dict[str, dict] = {}
    for row in rows:
        entry = {
            "term_roman": row.get("term_roman"),
            "direction_ambiguity": row.get("direction_ambiguity"),
            "typical_patterns": row.get("typical_patterns") or [],
            "meaning_en": row.get("meaning_en"),
        }
        forms = {str(row.get("term_roman") or "").lower()}
        for v in row.get("variants") or []:
            forms.add(str(v).lower().strip())
        for form in forms:
            if form:
                mapping[form] = entry
    return mapping


def build_question_map(rows: list[dict]) -> dict[str, dict]:
    return {
        str(row.get("pattern") or f"q-{i}").lower(): {
            "pattern": row.get("pattern"),
            "type": row.get("type"),
            "intent": row.get("intent"),
            "response_type": row.get("response_type"),
            "examples": row.get("examples") or [],
        }
        for i, row in enumerate(rows, start=1)
    }


def build_discourse_map(rows: list[dict]) -> dict[str, dict]:
    mapping: dict[str, dict] = {}
    for row in rows:
        entry = {
            "pattern": row.get("pattern"),
            "type": row.get("type"),
            "strength": row.get("strength"),
            "multi_turn_action": row.get("multi_turn_action"),
        }
        forms = {str(row.get("pattern") or "").lower()}
        for v in row.get("variants") or []:
            forms.add(str(v).lower().strip())
        for form in forms:
            if form:
                mapping[form] = entry
    return mapping


def build_time_map(rows: list[dict]) -> dict[str, dict]:
    mapping: dict[str, dict] = {}
    for row in rows:
        entry = {
            "pattern_type": row.get("pattern_type"),
            "gregorian_approx": row.get("gregorian_approx"),
            "fiscal_significance": row.get("fiscal_significance"),
            "terms": row.get("terms") or [],
        }
        for term in row.get("terms") or []:
            form = str(term).lower().strip()
            if form:
                mapping[form] = entry
    return mapping


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def update_manifest(results: list[dict]) -> None:
    manifest: dict = {"batches": {}, "totals": {}}
    if MANIFEST_PATH.exists():
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    for info in results:
        batch_meta = {
            "status": "ingested",
            "source": f"data/nepal-ai/language/{info['source']}",
            info["count_key"]: info["count"],
            "kb_chunks": info["kb_chunks"],
        }
        if info.get("map_entries") is not None:
            batch_meta["normalize_entries"] = info["map_entries"]
        manifest.setdefault("batches", {})[info["key"]] = batch_meta

    totals = manifest.setdefault("totals", {})
    for info in results:
        totals[info["key"]] = info["count"]

    totals["batches_complete"] = sum(
        1 for b in manifest.get("batches", {}).values() if b.get("status") == "ingested"
    )
    totals["batches_pending"] = 40 - totals["batches_complete"]
    manifest["next_batch"] = results[-1]["next"] if results else "11_retail_kirana"
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def ingest_one(batch: dict) -> dict | None:
    source = LANG_DIR / batch["source"]
    if not source.exists():
        print(f"Skip missing {source}", file=sys.stderr)
        return None

    rows = load_jsonl(source)
    chunks = [row_to_chunk(batch, r, i) for i, r in enumerate(rows, start=1)]
    out_dir = KB_LANG / batch["kb_subdir"]
    write_jsonl(out_dir / batch["source"], chunks)

    map_entries = 0
    if batch["key"] == "05_numbers_amounts":
        num_map = build_number_map(rows)
        LANG_DIR.joinpath("number_normalize_map.json").write_text(
            json.dumps(num_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        map_entries = len(num_map)
    elif batch["key"] == "06_profit_loss_vocab":
        pl_map = build_pl_map(rows)
        LANG_DIR.joinpath("profit_loss_map.json").write_text(
            json.dumps(pl_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        map_entries = len(pl_map)
    elif batch["key"] == "07_credit_debt_vocab":
        credit_map = build_credit_map(rows)
        LANG_DIR.joinpath("credit_debt_map.json").write_text(
            json.dumps(credit_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        map_entries = len(credit_map)
    elif batch["key"] == "08_question_patterns":
        q_map = build_question_map(rows)
        LANG_DIR.joinpath("question_pattern_map.json").write_text(
            json.dumps(q_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        map_entries = len(q_map)
    elif batch["key"] == "09_affirmation_negation":
        d_map = build_discourse_map(rows)
        LANG_DIR.joinpath("discourse_action_map.json").write_text(
            json.dumps(d_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        map_entries = len(d_map)
    elif batch["key"] == "10_time_date":
        t_map = build_time_map(rows)
        LANG_DIR.joinpath("time_date_map.json").write_text(
            json.dumps(t_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        map_entries = len(t_map)

    return {
        "key": batch["key"],
        "source": batch["source"],
        "count_key": batch["count_key"],
        "count": len(rows),
        "kb_chunks": len(chunks),
        "map_entries": map_entries,
        "next": batch["next"],
    }


def main() -> int:
    results: list[dict] = []
    for batch in BATCHES:
        info = ingest_one(batch)
        if info:
            results.append(info)
            print(
                f"{info['key']}: {info['count']} rows → {info['kb_chunks']} chunks, "
                f"{info['map_entries']} map entries"
            )

    if not results:
        print("No language batch files found", file=sys.stderr)
        return 1

    update_manifest(results)
    print(f"Updated manifest; next_batch={results[-1]['next']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
