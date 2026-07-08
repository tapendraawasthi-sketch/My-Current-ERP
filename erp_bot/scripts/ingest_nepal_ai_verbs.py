#!/usr/bin/env python3
"""Ingest Nepal Universal AI verb maps into e-Khata knowledge + normalization index."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANG_DIR = ROOT / "data" / "nepal-ai" / "language"
OUTPUT_DIR = ROOT / "data" / "ekhata" / "knowledge" / "general" / "language" / "verbs"
MANIFEST_PATH = ROOT / "data" / "nepal-ai" / "collection_manifest.json"

ACTION_TO_INTENT: dict[str, str] = {
    "PURCHASE": "khata_purchase",
    "SALE": "khata_cash_sale",
    "GIVE": "khata_payment_out",
    "RECEIVE": "khata_payment_in",
    "PAYMENT_OUT": "khata_payment_out",
    "INBOUND_RECEIPT": "khata_payment_in",
    "OUTBOUND": "khata_expense",
    "ACTION_GENERIC": "khata_journal",
    "HOLD_MAINTAIN": "khata_journal",
    "SEND_DISPATCH": "khata_journal",
    "RETURN_REFUND": "khata_sales_return",
    "DEPOSIT_COLLECT": "khata_payment_in",
    "WITHDRAWAL": "khata_payment_out",
    "RECORD_ENTRY": "khata_journal",
    "DECREASE_LOSS": "khata_expense",
    "INCREASE_GROWTH": "khata_other_income",
    "CREDIT_OUTSTANDING": "khata_credit_sale",
    "SETTLE_RECONCILE": "khata_payment_in",
    "CREATE_PREPARE": "khata_journal",
    "TRADE": "khata_purchase",
    "PAYMENT_SETTLEMENT": "khata_payment_out",
    "EXPENSE": "khata_expense",
    "EARN_INCOME": "khata_other_income",
    "SAVE_SAVINGS": "khata_journal",
    "LEND_LOAN_OUT": "khata_payment_out",
}

ROLE_TO_INTENT: dict[str, str] = {
    "COPULA_EVENT": "khata_journal",
    "EXISTENCE_COPULA": "khata_journal",
    "PERFECT_ASPECT": "khata_journal",
    "CONTINUITY_STATE": "khata_journal",
    "ABILITY_COMPLETION": "khata_journal",
    "OBLIGATION_NECESSITY": "khata_journal",
    "KNOWLEDGE_AWARENESS": "query",
    "DESIRE_INTENT": "khata_journal",
    "ARRIVAL_ABILITY": "khata_payment_in",
    "SUFFICIENCY_ARRIVAL": "khata_journal",
    "COMPREHENSION_RECEIPT": "khata_journal",
    "OMISSION_FORGET": "khata_journal",
    "RECALL_CONSIDERATION": "khata_journal",
    "INQUIRY_QUERY": "query",
    "SPEECH_LABEL": "khata_journal",
    "AUDITORY_RECEIPT": "khata_journal",
    "VISUAL_CHECK": "query",
    "SEARCH_SEEK": "query",
    "OBTAIN_RECEIVE": "khata_payment_in",
    "INPUT_ENTRY": "khata_journal",
}

BATCHES = [
    {
        "key": "02_verbs_core",
        "source": "verbs_core.jsonl",
        "output": "verbs_core.jsonl",
        "label": "BATCH 02",
        "next": "03_verbs_auxiliary",
    },
    {
        "key": "03_verbs_auxiliary",
        "source": "verbs_auxiliary.jsonl",
        "output": "verbs_auxiliary.jsonl",
        "label": "BATCH 03",
        "next": "04_particles",
    },
]


def load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def semantic_tag(row: dict) -> str:
    return row.get("semantic_action") or row.get("semantic_role") or ""


def intent_hint(row: dict) -> str:
    action = row.get("semantic_action", "")
    role = row.get("semantic_role", "")
    if action:
        return ACTION_TO_INTENT.get(action, "khata_journal")
    return ROLE_TO_INTENT.get(role, "khata_journal")


def verb_to_chunk(row: dict, batch_label: str) -> dict:
    lemma = row["lemma"]
    variants = row.get("variants") or []
    typos = row.get("common_typos") or []
    neg = row.get("negation_variants") or []
    examples = row.get("example_sentences") or []
    notes = row.get("parser_notes", "")
    tag = semantic_tag(row)

    ex_text = "\n".join(f"- {e.get('ne_roman', '')} ({e.get('en', '')})" for e in examples)
    if notes and not ex_text:
        ex_text = f"- parser: {notes}"

    content = (
        f"Lemma: {lemma} ({row.get('meaning_en', '')})\n"
        f"Semantic: {tag}\n"
        f"Variants: {', '.join(variants[:20])}\n"
        f"Common typos: {', '.join(typos)}\n"
        f"Negation: {', '.join(neg)}\n"
    )
    if row.get("signals_completion") is not None:
        content += f"Signals completion: {row['signals_completion']}\n"
    if notes:
        content += f"Notes: {notes}\n"
    if ex_text:
        content += f"Examples:\n{ex_text}"

    return {
        "id": f"verb-{lemma.replace(' ', '-')}",
        "segment": "general.language.verbs",
        "title": f"Verb: {lemma}",
        "content": content,
        "language": ["nepali", "romanized", "english"],
        "tags": ["verb", tag.lower(), lemma.replace(" ", "-")],
        "source": f"Nepal Universal AI {batch_label}",
        "metadata": {
            "lemma": lemma,
            "semantic_action": row.get("semantic_action"),
            "semantic_role": row.get("semantic_role"),
            "intent_hint": intent_hint(row),
            "signals_completion": row.get("signals_completion"),
            "variants": variants,
            "common_typos": typos,
            "negation_variants": neg,
            "tense_map": row.get("tense_map") or {},
            "parser_notes": notes,
            "example_sentences": examples,
        },
    }


def example_to_nlu_row(row: dict, ex: dict, idx: int, batch_label: str) -> dict:
    lemma = row["lemma"]
    text = ex.get("ne_roman", "")
    tag = semantic_tag(row)
    return {
        "id": f"nlu-verb-{lemma.replace(' ', '-')}-{idx:02d}",
        "segment": "general.language.verbs",
        "title": f"Verb example: {lemma}",
        "content": text,
        "language": ["romanized", "nepali"],
        "tags": ["verb_example", tag.lower()],
        "source": f"Nepal Universal AI {batch_label}",
        "metadata": {
            "input": text,
            "lemma": lemma,
            "semantic_action": row.get("semantic_action"),
            "semantic_role": row.get("semantic_role"),
            "intent_hint": intent_hint(row),
            "english": ex.get("en", ""),
            "domain_hint": "journal_entry",
        },
    }


def build_normalize_map(rows: list[dict]) -> dict[str, dict]:
    norm: dict[str, dict] = {}
    for row in rows:
        lemma = row["lemma"]
        action = row.get("semantic_action", "")
        role = row.get("semantic_role", "")
        entry = {
            "lemma": lemma,
            "semantic_action": action or None,
            "semantic_role": role or None,
            "intent_hint": intent_hint(row),
            "signals_completion": row.get("signals_completion"),
        }
        all_forms: set[str] = set()
        for key in ("variants", "common_typos", "negation_variants"):
            for v in row.get(key) or []:
                all_forms.add(v.lower().strip())
        all_forms.add(lemma.lower())
        for form in all_forms:
            if form and len(form) > 1:
                norm[form] = entry
    return norm


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def ingest_batch(batch: dict) -> tuple[int, int, list[dict]]:
    source = LANG_DIR / batch["source"]
    if not source.exists():
        print(f"Skip missing {source}", file=sys.stderr)
        return 0, 0, []

    rows = load_jsonl(source)
    label = batch["label"]
    verb_chunks = [verb_to_chunk(r, label) for r in rows]
    example_chunks: list[dict] = []
    for r in rows:
        for i, ex in enumerate(r.get("example_sentences") or [], start=1):
            example_chunks.append(example_to_nlu_row(r, ex, i, label))

    write_jsonl(OUTPUT_DIR / batch["output"], verb_chunks)
    return len(verb_chunks), len(example_chunks), rows


def update_manifest(results: dict[str, dict], norm_count: int) -> None:
    manifest: dict = {"batches": {}, "totals": {}}
    if MANIFEST_PATH.exists():
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    total_verbs = 0
    total_examples = 0
    for key, info in results.items():
        manifest.setdefault("batches", {})[key] = {
            "status": "ingested",
            "source": f"data/nepal-ai/language/{info['source_file']}",
            "verbs": info["verbs"],
            "examples": info["examples"],
        }
        total_verbs += info["verbs"]
        total_examples += info["examples"]

    totals = manifest.setdefault("totals", {})
    totals["verbs"] = total_verbs
    totals["verb_examples"] = total_examples
    totals["verb_normalize_entries"] = norm_count
    totals["batches_complete"] = sum(
        1 for b in manifest.get("batches", {}).values() if b.get("status") == "ingested"
    )
    totals["batches_pending"] = 40 - totals["batches_complete"]
    manifest["next_batch"] = "04_particles"
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    all_rows: list[dict] = []
    all_examples: list[dict] = []
    results: dict[str, dict] = {}

    for batch in BATCHES:
        verbs, examples, rows = ingest_batch(batch)
        if not rows:
            continue
        all_rows.extend(rows)
        results[batch["key"]] = {
            "verbs": verbs,
            "examples": examples,
            "source_file": batch["source"],
        }

    if not all_rows:
        print("No verb files found", file=sys.stderr)
        return 1

    for r in all_rows:
        for i, ex in enumerate(r.get("example_sentences") or [], start=1):
            batch_label = "BATCH 02" if r.get("semantic_action") else "BATCH 03"
            all_examples.append(example_to_nlu_row(r, ex, i, batch_label))

    write_jsonl(OUTPUT_DIR / "verb_examples.jsonl", all_examples)
    norm_map = build_normalize_map(all_rows)
    LANG_DIR.joinpath("verb_normalize_map.json").write_text(
        json.dumps(norm_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    update_manifest(results, len(norm_map))
    print(
        f"Ingested {len(all_rows)} verbs ({len(results)} batches), "
        f"{len(all_examples)} examples, {len(norm_map)} normalize entries"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
