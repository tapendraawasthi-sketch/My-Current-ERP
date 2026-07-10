"""Golden tests for all 226 contract-complete capabilities."""

from __future__ import annotations

import asyncio
import unittest

from src.nios.capabilities.runtime import capability_runtime
from src.nios.contracts.intelligence_contract import ObserveContext
from src.nios.kernel.kernel import get_kernel


class AllCapabilitiesGoldenTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        get_kernel()
        cls.cap_ids = capability_runtime.list_ids()

    def test_all_capabilities_registered(self):
        self.assertGreaterEqual(len(self.cap_ids), 800)

    def test_all_capabilities_seven_stages(self):
        async def _run_all():
            failures: list[str] = []
            for cap_id in self.cap_ids:
                ctx = ObserveContext(
                    session_id="golden-all",
                    channel="test",
                    raw_input={"message": "VAT on 1000"},
                    metadata={
                        "balance": {"cash": 1000, "bank": 2000},
                        "payload": {"amount": 1000, "basic_salary": 50000, "principal": 500000},
                    },
                )
                try:
                    explanation, trace = await capability_runtime.run(cap_id, ctx, "VAT on 1000")
                    if len(trace.get("stages", [])) != 7:
                        failures.append(f"{cap_id}: stages={len(trace.get('stages', []))}")
                    if not explanation.summary:
                        failures.append(f"{cap_id}: empty summary")
                except Exception as exc:
                    failures.append(f"{cap_id}: {exc}")
            return failures

        failures = asyncio.run(_run_all())
        self.assertEqual(failures, [], f"Failures: {failures[:10]}")


if __name__ == "__main__":
    unittest.main()
