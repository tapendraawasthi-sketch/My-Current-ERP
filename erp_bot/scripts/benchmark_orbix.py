#!/usr/bin/env python3
"""Phase 7F — Orbix benchmark: intent routing + optional live API latency.

Usage:
  cd erp_bot && python scripts/benchmark_orbix.py              # routing only
  cd erp_bot && python scripts/benchmark_orbix.py --live      # hit /orbix/chat/stream
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.agent.intent_router import _regex_fastpath, classify_intent_sync

# 50 curated prompts — Nepali/Romanized + English
BENCHMARK_PROMPTS: list[dict] = [
    {"id": 1, "q": "hello", "expect_intent": "chitchat", "max_ms": 4000},
    {"id": 2, "q": "namaste", "expect_intent": "chitchat", "max_ms": 4000},
    {"id": 3, "q": "ani aaja entry vayo kunai?", "expect_intent": "ledger_query", "max_ms": 500},
    {"id": 4, "q": "aaj kati entry gareko?", "expect_intent": "ledger_query", "max_ms": 500},
    {"id": 5, "q": "Ram ko baki kati cha?", "expect_intent": "ledger_query", "max_ms": 500},
    {"id": 6, "q": "cash kati cha?", "expect_intent": "ledger_query", "max_ms": 500},
    {"id": 7, "q": "bank balance kati?", "expect_intent": "ledger_query", "max_ms": 500},
    {"id": 8, "q": "aajako sales kati?", "expect_intent": "ledger_query", "max_ms": 500},
    {"id": 9, "q": "VAT rate Nepal ma kati ho?", "expect_intent": "accounting_qa", "max_ms": 20000},
    {"id": 10, "q": "TDS rate for house rent?", "expect_intent": "accounting_qa", "max_ms": 20000},
    {"id": 11, "q": "SSF contribution rate kati ho?", "expect_intent": "accounting_qa", "max_ms": 20000},
    {"id": 12, "q": "income tax slab Nepal", "expect_intent": "accounting_qa", "max_ms": 20000},
    {"id": 13, "q": "EIS invoice ke ho?", "expect_intent": "accounting_qa", "max_ms": 20000},
    {"id": 14, "q": "NFRS ma revenue kasari recognize garne?", "expect_intent": "accounting_qa", "max_ms": 20000},
    {"id": 15, "q": "journal entry kata cha?", "expect_intent": "erp_howto", "max_ms": 8000},
    {"id": 16, "q": "payment voucher kaha bata khulne?", "expect_intent": "erp_howto", "max_ms": 8000},
    {"id": 17, "q": "trial balance kasari herne?", "expect_intent": "erp_howto", "max_ms": 8000},
    {"id": 18, "q": "sales invoice shortcut ke ho?", "expect_intent": "erp_howto", "max_ms": 8000},
    {"id": 19, "q": "Where is the journal entry screen?", "expect_intent": "erp_howto", "max_ms": 8000},
    {"id": 20, "q": "Ram lai 5000 udhaar diye", "expect_intent": "khata_entry", "max_ms": 12000},
    {"id": 21, "q": "Shyam bata 10000 tireko", "expect_intent": "khata_entry", "max_ms": 12000},
    {"id": 22, "q": "Which component handles SalesInvoiceForm?", "expect_intent": "code_qa", "max_ms": 20000},
    {"id": 23, "q": "How is trial balance calculated in code?", "expect_intent": "code_qa", "max_ms": 20000},
    {"id": 24, "q": "What is depreciation?", "expect_intent": "accounting_qa", "max_ms": 20000},
    {"id": 25, "q": "capital of France", "expect_intent": "general_qa", "max_ms": 20000},
    {"id": 26, "q": "धन्यवाद", "expect_intent": "chitchat", "max_ms": 4000},
    {"id": 27, "q": "hijo entry gareko thiyo?", "expect_intent": "ledger_query", "max_ms": 500},
    {"id": 28, "q": "udhaar list dekha", "expect_intent": "ledger_query", "max_ms": 500},
    {"id": 29, "q": "party balance hera", "expect_intent": "ledger_query", "max_ms": 500},
    {"id": 30, "q": "gratuity calculation Nepal", "expect_intent": "accounting_qa", "max_ms": 20000},
    {"id": 31, "q": "fiscal year Nepal kati mahina?", "expect_intent": "accounting_qa", "max_ms": 20000},
    {"id": 32, "q": "double entry rule ke ho?", "expect_intent": "accounting_qa", "max_ms": 20000},
    {"id": 33, "q": "chart of accounts kaha cha?", "expect_intent": "erp_howto", "max_ms": 8000},
    {"id": 34, "q": "day book report shortcut", "expect_intent": "erp_howto", "max_ms": 8000},
    {"id": 35, "q": "balance sheet kasari print garne?", "expect_intent": "erp_howto", "max_ms": 8000},
    {"id": 36, "q": "GST return form Nepal", "expect_intent": "accounting_qa", "max_ms": 20000},
    {"id": 37, "q": "professional service ma TDS kati?", "expect_intent": "accounting_qa", "max_ms": 20000},
    {"id": 38, "q": "kunai entry aaja?", "expect_intent": "ledger_query", "max_ms": 500},
    {"id": 39, "q": "recent entries dekha", "expect_intent": "ledger_query", "max_ms": 500},
    {"id": 40, "q": "good morning", "expect_intent": "chitchat", "max_ms": 4000},
    {"id": 41, "q": "bye", "expect_intent": "chitchat", "max_ms": 4000},
    {"id": 42, "q": "VAT inclusive price ma 13% kasari nikalne?", "expect_intent": "accounting_qa", "max_ms": 20000},
    {"id": 43, "q": "purchase return invoice kaha?", "expect_intent": "erp_howto", "max_ms": 8000},
    {"id": 44, "q": "billing tab ma sales return", "expect_intent": "erp_howto", "max_ms": 8000},
    {"id": 45, "q": "eKhata store implementation where?", "expect_intent": "code_qa", "max_ms": 20000},
    {"id": 46, "q": "कति प्रविष्टि आज?", "expect_intent": "ledger_query", "max_ms": 500},
    {"id": 47, "q": "बाँकी कति छ?", "expect_intent": "ledger_query", "max_ms": 500},
    {"id": 48, "q": "help me", "expect_intent": None, "max_ms": 20000},
    {"id": 49, "q": "supplier lai 25000 paisa diye", "expect_intent": "khata_entry", "max_ms": 12000},
    {"id": 50, "q": "VAT registration threshold Nepal", "expect_intent": "accounting_qa", "max_ms": 20000},
]


@dataclass
class RowResult:
    id: int
    query: str
    intent: str
    expected: str | None
    correct: bool
    ms: float
    model: str
    method: str


def route_one(query: str) -> tuple[str, str, float]:
    t0 = time.perf_counter()
    fast = _regex_fastpath(query)
    if fast:
        return fast.intent, fast.method, (time.perf_counter() - t0) * 1000
    route = classify_intent_sync(query)
    return route.intent, route.method, (time.perf_counter() - t0) * 1000


def run_routing_benchmark() -> list[RowResult]:
    rows: list[RowResult] = []
    for item in BENCHMARK_PROMPTS:
        intent, method, ms = route_one(item["q"])
        expected = item.get("expect_intent")
        correct = expected is None or intent == expected
        rows.append(
            RowResult(
                id=item["id"],
                query=item["q"],
                intent=intent,
                expected=expected,
                correct=correct,
                ms=ms,
                model="n/a",
                method=method,
            )
        )
    return rows


def run_live_benchmark(base_url: str) -> None:
    import httpx

    for item in BENCHMARK_PROMPTS[:10]:
        t0 = time.perf_counter()
        try:
            with httpx.stream(
                "POST",
                f"{base_url.rstrip('/')}/orbix/chat/stream",
                json={"message": item["q"], "session_id": "benchmark"},
                timeout=120,
            ) as resp:
                resp.raise_for_status()
                for _ in resp.iter_lines():
                    pass
        except Exception as exc:
            print(f"  LIVE FAIL #{item['id']}: {exc}")
            continue
        ms = (time.perf_counter() - t0) * 1000
        ok = ms <= item["max_ms"]
        print(f"  #{item['id']:02d} {ms:7.0f}ms {'OK' if ok else 'SLOW'} — {item['q'][:50]}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Orbix Phase 7 benchmark")
    parser.add_argument("--live", action="store_true", help="Hit live /orbix/chat/stream (first 10)")
    parser.add_argument("--base-url", default="http://localhost:8765")
    args = parser.parse_args()

    if args.live:
        print("Live stream benchmark (first 10 prompts):")
        run_live_benchmark(args.base_url)
        return 0

    rows = run_routing_benchmark()
    correct = sum(1 for r in rows if r.correct)
    total = len(rows)
    pct = 100.0 * correct / total if total else 0.0

    print(f"Intent routing: {correct}/{total} correct ({pct:.1f}%)")
    print(f"Target: >= 90% on fixed-expect prompts\n")

    failures = [r for r in rows if not r.correct]
    for r in failures:
        print(f"  FAIL #{r.id}: got {r.intent}, want {r.expected} — {r.query!r}")

    slow = [r for r in rows if r.ms > 50]
    if slow:
        print(f"\nSlow regex routes (>50ms): {len(slow)}")

    out_path = BOT_ROOT / "data" / "benchmark_orbix_last.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps([r.__dict__ for r in rows], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\nWrote {out_path}")

    return 0 if pct >= 90.0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
