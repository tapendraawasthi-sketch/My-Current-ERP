"""Persistent production telemetry — tier mix, latency, hallucination proxy."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _db_path() -> Path:
    data_dir = Path(os.getenv("NIOS_DATA_DIR", "data"))
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "nios_telemetry.sqlite3"


_SCHEMA = """
CREATE TABLE IF NOT EXISTS request_telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT NOT NULL,
  engine TEXT NOT NULL,
  tier TEXT NOT NULL,
  latency_ms REAL NOT NULL,
  intent TEXT,
  has_high_trust_evidence INTEGER NOT NULL DEFAULT 0,
  policy_blocked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_telemetry_at ON request_telemetry(recorded_at);
"""


class TelemetryStore:
    def __init__(self) -> None:
        self._init()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(_db_path())
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self) -> None:
        with self._connect() as conn:
            conn.executescript(_SCHEMA)
            conn.commit()

    def record_request(
        self,
        *,
        engine: str,
        tier: str,
        latency_ms: float,
        intent: str | None = None,
        has_high_trust_evidence: bool = False,
        policy_blocked: bool = False,
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO request_telemetry
                  (recorded_at, engine, tier, latency_ms, intent, has_high_trust_evidence, policy_blocked)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    _now(),
                    engine,
                    tier,
                    latency_ms,
                    intent,
                    1 if has_high_trust_evidence else 0,
                    1 if policy_blocked else 0,
                ),
            )
            conn.commit()

    def stats(self, *, limit: int = 500) -> dict[str, float]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT engine, tier, latency_ms, has_high_trust_evidence, policy_blocked
                FROM request_telemetry
                ORDER BY id DESC LIMIT ?
                """,
                (limit,),
            ).fetchall()

        if not rows:
            return {"request_count": 0}

        tier_0_2 = tier_3 = tier_4_5 = 0
        latencies: list[float] = []
        high_trust = 0
        policy_blocks = 0

        for r in rows:
            engine = r["engine"] or ""
            tier = r["tier"] or ""
            latencies.append(float(r["latency_ms"]))
            if r["has_high_trust_evidence"]:
                high_trust += 1
            if r["policy_blocked"]:
                policy_blocks += 1

            if (
                engine.startswith("nios_cache")
                or engine.startswith("nios_deterministic")
                or engine.startswith("nios_erp")
                or engine.startswith("nios_scheduler")
                or engine.startswith("nios_accounting")
                or tier in ("none", "tier_0_2")
            ):
                tier_0_2 += 1
            elif engine.startswith("nios_cascade") or "planner" in engine or tier in ("32b", "planner", "tier_4_5"):
                tier_4_5 += 1
            else:
                tier_3 += 1

        total = len(rows)
        sorted_lat = sorted(latencies)
        p95 = sorted_lat[int(len(sorted_lat) * 0.95)] if sorted_lat else 0.0
        unsupported_pct = round((1 - high_trust / total) * 100, 2) if total else 0.0

        return {
            "request_count": total,
            "tier_0_2_pct": round(tier_0_2 / total * 100, 1),
            "tier_3_pct": round(tier_3 / total * 100, 1),
            "tier_4_5_pct": round(tier_4_5 / total * 100, 1),
            "avg_latency_ms": round(sum(latencies) / total, 1),
            "p95_latency_ms": round(p95, 1),
            "hallucination_proxy_pct": round(min(100.0, unsupported_pct * 0.1), 2),
            "policy_violations": policy_blocks,
            "live": True,
        }


telemetry_store = TelemetryStore()
