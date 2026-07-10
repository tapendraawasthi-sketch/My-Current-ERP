"""Plan completion verification — all phase exit criteria."""

from __future__ import annotations

import asyncio
import unittest

from src.nios.agents.society import AGENT_ROLES
from src.nios.capabilities.runtime import capability_runtime
from src.nios.capabilities.top50 import bootstrap_top50
from src.nios.capabilities.catalog_runtime import bootstrap_catalog_capabilities
from src.nios.contracts.intelligence_contract import ObserveContext
from src.nios.cognitive.meta_reasoner import meta_reasoner
from src.nios.dsl.compilers.uil_compiler import compile_uil_pipeline
from src.nios.kernel.capability_registry import registry
from src.nios.kernel.memory_bus import memory_bus, LEVELS
from src.nios.knowledge.federation import federated_knowledge
from src.nios.knowledge.policy_dsl import BOOTSTRAP_POLICIES
from src.nios.marketplace.capability_catalog import register_catalog
from src.nios.marketplace.skills import marketplace
from src.nios.benchmarks.nightly.runner import ALL_SUITES_WITH_NEPAL_AI, nightly_runner
from src.nios.learning.evolution.reasoner_adapter import evolution_registry, ReasonerRequest


class PlanCompletionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        register_catalog(registry)
        bootstrap_top50(registry)
        bootstrap_catalog_capabilities(registry)

    def test_phase0_contract_adoption_800(self):
        total = len(registry.list_all())
        impl = len(capability_runtime.list_ids())
        self.assertGreaterEqual(total, 800)
        self.assertEqual(impl, total)

    def test_phase0_catalog_stats(self):
        from src.nios.marketplace.capability_catalog import catalog_stats
        s = catalog_stats()
        self.assertGreaterEqual(s["total"], 800)
        self.assertEqual(s["y1_capabilities"], 200)
        self.assertEqual(s["y2_capabilities"], 600)

    def test_phase1_uil_dsl_roundtrip(self):
        r = compile_uil_pipeline("Ram le 500 ko saman becheko")
        self.assertEqual(r["uil"]["action"], "sell")
        self.assertTrue(r["accounting"]["balanced"])
        self.assertIn("legal", r)

    def test_phase1_policy_dsl(self):
        self.assertGreaterEqual(len(BOOTSTRAP_POLICIES), 5)

    def test_phase2_meta_reasoner_skips_llm(self):
        ev = meta_reasoner.best_action({
            "message": "VAT on 1000",
            "uil_confidence": 0.9,
            "capabilities": ["cap.engine.tax.vat"],
            "evidence_coverage": 1.0,
        })
        self.assertIn(ev.action, ("calculate", "retrieve", "explain"))

    def test_phase2_memory_bus_7_levels(self):
        self.assertEqual(len(LEVELS), 7)
        for level in LEVELS:
            memory_bus.write(level, f"test-{level}", {"v": 1}, session_id="plan-test")
        stats = memory_bus.stats()
        self.assertGreaterEqual(len(stats), 7)

    def test_phase2_federation_7_sources(self):
        sources = {a.source_id for a in federated_knowledge.adapters}
        expected = {
            "federation.erp", "federation.ontology", "federation.gov",
            "federation.nepse", "federation.memory", "federation.vector",
            "federation.web", "federation.files", "federation.partner",
        }
        self.assertTrue(expected.issubset(sources))

    def test_phase3_agent_society_11_roles(self):
        self.assertEqual(len(AGENT_ROLES), 11)

    def test_phase3_marketplace_20_skills_5_workflows(self):
        self.assertGreaterEqual(len(marketplace.list_skills()), 20)
        self.assertGreaterEqual(len(marketplace.list_workflows()), 5)

    def test_phase5_benchmarks_500_plus(self):
        total = sum(len(s.cases) for s in ALL_SUITES_WITH_NEPAL_AI)
        self.assertGreaterEqual(total, 500)

    def test_phase5_model_swap(self):
        async def _run():
            adapter = evolution_registry.get("reasoner.mock")
            resp = await adapter.reason(ReasonerRequest(prompt="test"))
            return resp.confidence

        self.assertGreaterEqual(asyncio.run(_run()), 0.9)

    def test_nightly_all_green(self):
        report = nightly_runner.run_all()
        self.assertTrue(report.ok, f"Failures: {report.total_failed}")


if __name__ == "__main__":
    unittest.main()
