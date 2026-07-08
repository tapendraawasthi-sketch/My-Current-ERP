#!/usr/bin/env python3
"""Ingest Nepal Universal AI sector phrase batches into e-Khata knowledge."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SECTOR_DIR = ROOT / "data" / "nepal-ai" / "sectors"
OUTPUT_BASE = ROOT / "data" / "ekhata" / "knowledge" / "general" / "sector"
MANIFEST_PATH = ROOT / "data" / "nepal-ai" / "collection_manifest.json"

SECTOR_SLUG_MAP: dict[str, str] = {
    "retail_kirana": "kirana-grocery",
    "hardware_construction": "hardware-construction-materials-shop",
    "restaurant_cafe": "restaurant-cafe",
    "mobile_electronics": "electronics-mobile-shop",
    "health_admin": "clinic-health",
    "transport_logistics": "transport-logistics",
    "agriculture": "agriculture-farming",
    "education": "education-training",
    "professional_services": "professional-services",
}

INTENT_TO_KHATA: dict[str, str] = {
    "daily_sales_summary": "khata_cash_sale",
    "cash_sale": "khata_cash_sale",
    "expense": "khata_expense",
    "purchase_cash": "khata_purchase",
    "khata_credit_purchase": "khata_purchase",
    "khata_credit_sale": "khata_credit_sale",
    "advance_received": "khata_payment_in",
    "payment_made": "khata_payment_out",
    "payment_received": "khata_payment_in",
    "bad_debt": "khata_expense",
    "wastage": "khata_expense",
    "return_sale": "khata_sales_return",
    "return_purchase": "khata_purchase_return",
    "sales_return": "khata_sales_return",
    "purchase_return": "khata_purchase_return",
    "discount_given": "khata_journal",
    "cash_discrepancy": "khata_expense",
    "purchase_inquiry": "query",
    "price_inquiry": "query",
    "quotation_request": "query",
    "khata_balance_check": "query",
    "discount_request": "khata_journal",
    "service_cash": "khata_cash_sale",
    "job_received": "query",
    "advance_paid": "khata_payment_out",
    "loss_defective_part": "khata_expense",
    "loss_irreparable": "khata_expense",
    "unclaimed_item": "query",
    "trade_profit": "khata_journal",
    "job_diagnosis": "query",
    "inventory_write_down": "khata_expense",
    "stock_inquiry": "query",
    "purchase_discount": "khata_journal",
    "patient_count_log": "query",
    "trip_income": "khata_cash_sale",
    "daily_income_summary": "khata_cash_sale",
    "khata_credit_income": "khata_credit_sale",
    "receivable_overdue": "query",
    "contract_income": "khata_credit_sale",
    "khata_loss_write_off": "khata_expense",
    "khata_loan_repayment": "khata_loan_repayment",
    "khata_income": "khata_income",
    "khata_insurance_premium": "khata_expense",
    "khata_asset_purchase": "khata_purchase",
    "khata_receipt": "khata_cash_sale",
    "khata_outstanding": "query",
    "khata_purchase": "khata_purchase",
    "khata_cash_sale": "khata_cash_sale",
    "khata_expense": "khata_expense",
    "khata_salary_payment": "khata_salary_payment",
    "khata_rent_expense": "khata_rent_expense",
    "khata_discount_allowed": "khata_journal",
    "khata_payment_in": "khata_payment_in",
    "khata_loan_received": "khata_loan_received",
    "khata_credit_purchase": "khata_purchase",
}

BATCH_BY_FILE: dict[str, dict] = {
    "retail_kirana.jsonl": {"key": "11_retail_kirana", "next": "12_hardware_construction"},
    "hardware_construction.jsonl": {"key": "12_hardware_construction", "next": "14_mobile_electronics"},
    "restaurant_cafe.jsonl": {"key": "13_restaurant_cafe", "next": "14_mobile_electronics"},
    "mobile_electronics.jsonl": {"key": "14_mobile_electronics", "next": "15_health_admin"},
    "health_admin.jsonl": {"key": "15_health_admin", "next": "16_transport_logistics"},
    "transport_logistics.jsonl": {"key": "16_transport_logistics", "next": "17_agriculture"},
    "agriculture.jsonl": {"key": "17_agriculture", "next": "18_education"},
    "education.jsonl": {"key": "18_education", "next": "19_professional_services"},
    "professional_services.jsonl": {"key": "19_professional_services", "next": "20_polysemy"},
}


def normalize_row(row: dict) -> dict:
    out = dict(row)
    if "clarify_needed" in out and "needs_clarify" not in out:
        out["needs_clarify"] = bool(out["clarify_needed"])
    if out.get("clarify_slot") and not out.get("clarify_question"):
        out["needs_clarify"] = True
    if not out.get("normalized") and out.get("input"):
        out["normalized"] = str(out["input"]).lower()
    return out


def load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(normalize_row(json.loads(line)))
    return rows


def slugify_sector(sector: str) -> str:
    return SECTOR_SLUG_MAP.get(sector, sector.replace("_", "-"))


def phrase_to_chunk(row: dict, idx: int, slug: str, batch_key: str) -> dict:
    intent = row.get("intent", "")
    entities = row.get("entities") or {}
    content = (
        f"Input: {row.get('input', '')}\n"
        f"Normalized: {row.get('normalized', '')}\n"
        f"Intent: {intent}\n"
        f"Khata intent: {INTENT_TO_KHATA.get(intent, 'khata_journal')}\n"
        f"Entities: {json.dumps(entities, ensure_ascii=False)}\n"
        f"Needs clarify: {row.get('needs_clarify', False)}\n"
        f"Clarify: {row.get('clarify_question') or ''}\n"
        f"Register: {row.get('register', '')}"
    )
    return {
        "id": f"sector-{slug}-{idx:03d}",
        "segment": f"general.sector.{slug}",
        "title": f"Sector phrase: {row.get('input', '')[:60]}",
        "content": content,
        "language": ["romanized", "nepali", "english"],
        "tags": ["sector_phrase", slug, intent, row.get("register", "colloquial")],
        "source": f"Nepal Universal AI BATCH {batch_key.split('_')[0]}",
        "metadata": {
            "input": row.get("input"),
            "normalized": row.get("normalized"),
            "intent": intent,
            "intent_hint": INTENT_TO_KHATA.get(intent, "khata_journal"),
            "entities": entities,
            "needs_clarify": row.get("needs_clarify", False),
            "clarify_question": row.get("clarify_question"),
            "sector": row.get("sector"),
            "sector_slug": slug,
            "register": row.get("register"),
            "domain_hint": "journal_entry",
        },
    }


def eval_row(row: dict, idx: int, slug: str) -> dict:
    intent = row.get("intent", "")
    return {
        "id": f"eval-{slug}-{idx:03d}",
        "input": row.get("input", ""),
        "normalized": row.get("normalized", ""),
        "expected_intent": INTENT_TO_KHATA.get(intent, intent),
        "sector_intent": intent,
        "entities": row.get("entities") or {},
        "needs_clarify": row.get("needs_clarify", False),
        "clarify_question": row.get("clarify_question"),
        "sector": slug,
    }


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def ingest_file(path: Path) -> dict | None:
    batch = BATCH_BY_FILE.get(path.name)
    if not batch:
        print(f"Skip unknown sector file {path.name}", file=sys.stderr)
        return None

    rows = load_jsonl(path)
    if not rows:
        return None

    sector = rows[0].get("sector") or path.stem
    slug = slugify_sector(str(sector))
    chunks = [phrase_to_chunk(r, i, slug, batch["key"]) for i, r in enumerate(rows, start=1)]
    eval_rows = [eval_row(r, i, slug) for i, r in enumerate(rows, start=1)]

    out_dir = OUTPUT_BASE / slug
    write_jsonl(out_dir / "router_phrases.jsonl", chunks)
    write_jsonl(out_dir / "eval_phrases.jsonl", eval_rows)

    return {
        "key": batch["key"],
        "source": f"data/nepal-ai/sectors/{path.name}",
        "sector": sector,
        "sector_slug": slug,
        "phrases": len(rows),
        "clarify_cases": sum(1 for r in rows if r.get("needs_clarify")),
        "next": batch["next"],
    }


def update_manifest(results: list[dict]) -> None:
    manifest: dict = {"batches": {}, "totals": {}}
    if MANIFEST_PATH.exists():
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    sector_phrases = 0
    for info in results:
        manifest.setdefault("batches", {})[info["key"]] = {
            "status": "ingested",
            "source": info["source"],
            "sector": info["sector"],
            "sector_slug": info["sector_slug"],
            "phrases": info["phrases"],
            "clarify_cases": info["clarify_cases"],
        }
        sector_phrases += info["phrases"]

    totals = manifest.setdefault("totals", {})
    totals["sector_phrase_batches"] = len(results)
    totals["sector_phrases"] = totals.get("sector_phrases", 0)
    # recount from all ingested sector batches in manifest
    totals["sector_phrases"] = sum(
        b.get("phrases", 0)
        for b in manifest.get("batches", {}).values()
        if b.get("status") == "ingested" and "sector_slug" in b
    )
    totals["batches_complete"] = sum(
        1 for b in manifest.get("batches", {}).values() if b.get("status") == "ingested"
    )
    totals["batches_pending"] = 40 - totals["batches_complete"]
    manifest["next_batch"] = results[-1]["next"] if results else manifest.get("next_batch")
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    targets = sys.argv[1:] if len(sys.argv) > 1 else list(BATCH_BY_FILE)
    results: list[dict] = []
    for name in targets:
        path = SECTOR_DIR / name if not Path(name).is_absolute() else Path(name)
        if not path.exists():
            print(f"Missing {path}", file=sys.stderr)
            continue
        info = ingest_file(path)
        if info:
            results.append(info)
            print(
                f"{info['key']}: {info['phrases']} phrases → {info['sector_slug']} "
                f"({info['clarify_cases']} clarify)"
            )

    if not results:
        return 1
    update_manifest(results)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
