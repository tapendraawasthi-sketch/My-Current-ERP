#!/usr/bin/env python3
"""Verify NIOS production ops: PG memory, feeds, telemetry, quality gates."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

import src.config  # noqa: F401

from src.nios.gateway import get_gateway
from src.nios.governance.architecture_rubric import architecture_rubric
from src.nios.governance.quality_gates import quality_gate_engine
from src.nios.kernel.kernel import get_kernel
from src.nios.kernel.telemetry_store import telemetry_store
from src.nios.knowledge.feeds import refresh_feeds, load_feeds


BALANCE = {
    "cash": 150_000,
    "bank": 320_000,
    "receivable": 85_000,
    "payable": 42_000,
    "revenue": 600_000,
    "expense": 410_000,
}

SEED_MESSAGES = [
    "Ram ko balance kati ho",
    "VAT on 1000 calculate garnu",
    "Ram le 500 ko chawal becheko",
    "trial balance",
    "profit loss report",
    "NEPSE NABIL quote",
    "cash balance kitna cha",
    "TDS on 50000",
    "optimize payroll budget 80000",
    "VAT rate kati ho Nepal ma",
    "Shyam bata 2000 ko saman kineko",
    "aging report receivable",
]


async def seed_chat() -> int:
    gateway = get_gateway()
    ok = 0
    for i, msg in enumerate(SEED_MESSAGES):
        try:
            await gateway.chat(
                msg,
                session_id=f"seed-{i}",
                balance=BALANCE,
            )
            ok += 1
        except Exception as exc:
            print(f"  [warn] chat failed: {msg[:40]} — {exc}")
    return ok


def main() -> int:
    print("=== NIOS Production Verification ===\n")

    kernel = get_kernel()
    backend = getattr(kernel.memory_bus, "backend", "sqlite")
    print(f"Memory backend: {backend}")
    if backend == "postgres":
        kernel.memory_bus.write("working", "prod_verify", {"ts": "ok"}, session_id="verify")
        print(f"PG write/read: {kernel.memory_bus.read('working', 'prod_verify', session_id='verify')}")
    else:
        print("[WARN] Expected postgres — check erp_bot/.env and DATABASE_URL")

    feeds = refresh_feeds(live=False)
    loaded = load_feeds()
    print(f"Feeds: source={feeds.get('source')} nepse_symbols={len(loaded.get('nepse', {}))}")

    print(f"\nSeeding {len(SEED_MESSAGES)} chat requests for telemetry...")
    n = asyncio.run(seed_chat())
    print(f"Seeded: {n}/{len(SEED_MESSAGES)}")

    tstats = telemetry_store.stats()
    print(f"Telemetry: requests={tstats.get('request_count')} tier_0_2={tstats.get('tier_0_2_pct')}% p95={tstats.get('p95_latency_ms')}ms")

    qg = quality_gate_engine.compute()
    print(f"Quality gates: all_pass={qg.all_pass} live_tier={qg.tier_mix.get('live')}")

    rubric = architecture_rubric.evaluate()
    print(f"Architecture: {rubric.overall}/9.99 passed={rubric.passed}")

    print("\n=== Done ===")
    return 0 if backend == "postgres" and n >= 8 else 1


if __name__ == "__main__":
    raise SystemExit(main())
