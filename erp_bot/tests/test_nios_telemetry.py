"""Telemetry store tests."""

from __future__ import annotations

import unittest

from src.nios.kernel.telemetry_store import telemetry_store


class TelemetryStoreTests(unittest.TestCase):
    def test_record_and_stats(self):
        telemetry_store.record_request(
            engine="nios_deterministic",
            tier="tier_0_2",
            latency_ms=45.0,
            intent="ledger_query",
            has_high_trust_evidence=True,
        )
        stats = telemetry_store.stats()
        self.assertGreaterEqual(stats.get("request_count", 0), 1)


if __name__ == "__main__":
    unittest.main()
