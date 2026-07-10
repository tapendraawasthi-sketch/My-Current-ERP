"""Golden tests for top 50 contract-complete capabilities."""

from __future__ import annotations

import asyncio
import unittest

from src.nios.capabilities.runtime import capability_runtime
from src.nios.capabilities.top50 import TOP_50_CAPABILITY_IDS, bootstrap_top50
from src.nios.contracts.intelligence_contract import ObserveContext
from src.nios.kernel.capability_registry import registry


class Top50ContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        bootstrap_top50(registry)

    def test_fifty_capabilities_registered(self):
        ids = [i for i in capability_runtime.list_ids() if i in TOP_50_CAPABILITY_IDS]
        self.assertEqual(len(ids), 50)

    def test_all_top50_seven_stages(self):
        async def _run_all():
            for cap_id in capability_runtime.list_ids():
                ctx = ObserveContext(
                    session_id="top50-test",
                    channel="test",
                    raw_input={"message": "VAT on 1000"},
                    metadata={"payload": {"amount": 1000, "basic_salary": 50000}},
                )
                explanation, trace = await capability_runtime.run(cap_id, ctx, "VAT on 1000")
                self.assertIn("stages", trace)
                self.assertEqual(len(trace["stages"]), 7)
                self.assertIsNotNone(explanation.summary)

        asyncio.run(_run_all())


if __name__ == "__main__":
    unittest.main()
