"""Architecture rubric tests."""

from __future__ import annotations

import unittest

from src.nios.governance.architecture_rubric import architecture_rubric
from src.nios.kernel.kernel import get_kernel
from src.nios.marketplace.capability_catalog import catalog_stats


class ArchitectureRubricTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        get_kernel()

    def test_catalog_800_plus(self):
        stats = catalog_stats()
        self.assertGreaterEqual(stats["total"], 800)

    def test_rubric_evaluates(self):
        report = architecture_rubric.evaluate()
        self.assertGreaterEqual(report.overall, 9.5)
        self.assertGreaterEqual(len(report.areas), 10)
        self.assertEqual(report.target, 9.99)

    def test_rubric_areas_have_evidence(self):
        report = architecture_rubric.evaluate()
        for area in report.areas:
            self.assertTrue(area.evidence)
            self.assertGreaterEqual(area.score, 9.0)


if __name__ == "__main__":
    unittest.main()
