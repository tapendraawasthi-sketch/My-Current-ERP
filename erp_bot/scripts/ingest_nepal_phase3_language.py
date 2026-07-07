#!/usr/bin/env python3
"""Ingest Phase 3 NLU language dataset into tiered knowledge segments."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = "Nepal NLU Phase 3 Language Dataset (AI Training)"

SEGMENT_BY_LANG = {
    "english": "general.language.english",
    "nepali": "general.language.nepali",
    "romanized": "general.language.romanized",
    "mixed": "general.language.romanized",
}

# Low-confidence / non-transaction → also useful for journal_entry clarification routing
AMBIGUOUS_INTENTS = {
    "unclear",
    "flag_duplicate_transaction",
    "flag_stock_discrepancy",
    "flag_cash_discrepancy",
    "flag_discrepancy",
    "clarify_vat_status",
    "clarify_payment_mode",
    "no_transaction",
    "request_report",
    "request_reconciliation",
    "request_print_bill",
    "policy_question",
    "status_update",
    "business_setup_info",
}


def chunk_id(row: dict, idx: int) -> str:
    base = (row.get("user_input") or "")[:80]
    h = hashlib.md5(base.encode()).hexdigest()[:8]
    lang = row.get("language_type") or "unknown"
    return f"phase3-{lang}-{idx:04d}-{h}"


def build_content(row: dict) -> str:
    parts = [
        f"PHASE 3 NLU — language_type={row.get('language_type', '')}",
        f"User input: {row.get('user_input', '')}",
        f"Corrected: {row.get('corrected_input', '')}",
        f"Meaning: {row.get('normalized_accounting_meaning', '')}",
        f"Intent: {row.get('intent', '')}",
        f"Category: {row.get('transaction_category', '')}",
        f"Confidence: {row.get('confidence', '')}",
        f"Clarification needed: {row.get('clarification_needed', '')}",
    ]
    if row.get("clarification_question"):
        parts.append(f"Clarify ask: {row['clarification_question']}")
    if row.get("possible_journal_entry"):
        parts.append(f"Journal hint: {row['possible_journal_entry']}")
    return "\n".join(parts)


def row_to_chunk(row: dict, idx: int) -> dict:
    lang = row.get("language_type") or "romanized"
    segment = SEGMENT_BY_LANG.get(lang, "general.language.romanized")
    intent = row.get("intent") or ""
    conf = float(row.get("confidence") or 0)
    tags = ["phase3", "nlu", lang, row.get("transaction_category") or "unknown"]
    if intent:
        tags.append(intent)
    if row.get("clarification_needed") or conf < 0.5 or intent in AMBIGUOUS_INTENTS:
        tags.append("clarification_required")
    if conf < 0.35:
        tags.append("do_not_post")

    title_src = row.get("corrected_input") or row.get("user_input") or "NLU example"
    title = (title_src[:70] + "…") if len(title_src) > 70 else title_src

    chunk = {
        "id": chunk_id(row, idx),
        "title": title,
        "content": build_content(row),
        "segment": segment,
        "language": list({lang, "nepali", "english", "romanized"}),
        "tags": tags,
        "source": SOURCE,
        "intent": intent,
        "confidence": conf,
        "language_type": lang,
        "transaction_category": row.get("transaction_category"),
        "clarification_needed": bool(row.get("clarification_needed")),
    }
    return chunk


def _parse_jsonl_line(line: str, line_no: int, source: Path) -> dict | None:
    """Parse one JSONL record; repair common Part-2 typo where possible_journal_entry is outside the object."""
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        fixed = re.sub(
            r'("\s*)\},\s*"possible_journal_entry"\s*:',
            r'\1,"possible_journal_entry":',
            line,
        )
        if fixed != line:
            try:
                return json.loads(fixed)
            except json.JSONDecodeError:
                pass
        print(f"Skip bad line {line_no} in {source.name}: {line[:120]}…")
        return None


def load_raw_rows(*raw_paths: Path) -> list[dict]:
    rows: list[dict] = []
    for raw_path in raw_paths:
        for i, line in enumerate(raw_path.read_text(encoding="utf-8").splitlines(), 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            row = _parse_jsonl_line(line, i, raw_path)
            if row:
                rows.append(row)
    return rows


def ingest(raw_paths: list[Path]) -> dict[str, int]:
    rows = load_raw_rows(*raw_paths)

    by_segment: dict[str, list[dict]] = {}
    for i, row in enumerate(rows):
        chunk = row_to_chunk(row, i)
        by_segment.setdefault(chunk["segment"], []).append(chunk)

    counts: dict[str, int] = {}
    for segment, chunks in by_segment.items():
        rel = segment.replace(".", "/")
        # general.language.english → general/language/english/nepal-phase3-nlu.jsonl
        parts = rel.split("/")
        out_dir = ROOT / "data" / "ekhata" / "knowledge" / Path(*parts)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "nepal-phase3-nlu.jsonl"
        with out_path.open("w", encoding="utf-8") as f:
            for c in chunks:
                f.write(json.dumps(c, ensure_ascii=False) + "\n")
        counts[segment] = len(chunks)
        print(f"Wrote {len(chunks)} → {out_path.relative_to(ROOT)}")

    return counts


def _default_raw_paths() -> list[Path]:
    ingest_dir = ROOT / "data" / "ekhata" / "knowledge" / "_ingest"
    paths = sorted(ingest_dir.glob("phase3_language_raw*.jsonl"))
    if paths:
        return paths
    fallback = ingest_dir / "phase3_language_raw.jsonl"
    return [fallback] if fallback.exists() else []


def main() -> None:
    if len(sys.argv) > 1:
        raw_paths = [Path(p) for p in sys.argv[1:]]
    else:
        raw_paths = _default_raw_paths()
    missing = [p for p in raw_paths if not p.exists()]
    if missing or not raw_paths:
        print(f"Missing raw file(s): {missing or 'none found'}")
        sys.exit(1)
    print("Ingesting from:", ", ".join(p.name for p in raw_paths))
    counts = ingest(raw_paths)
    print("Total by segment:", counts, "sum=", sum(counts.values()))

    sys.path.insert(0, str(ROOT / "erp_bot"))
    from src.knowledge.knowledge_registry import load_all_chunks

    total = len(load_all_chunks(force_reload=True))
    print("KB total chunks after reload:", total)


if __name__ == "__main__":
    main()
