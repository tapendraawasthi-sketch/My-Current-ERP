"""Gateway scheduler + goal tree integration tests."""

from __future__ import annotations

import asyncio
import unittest

from src.nios.agents.goal_tree import build_goal_tree
from src.nios.gateway_scheduler import execute_goal_tree
from src.nios.kernel.kernel import KernelContext, get_kernel
from src.nios.representations.uil_parser import parse_to_uil


class SchedulerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        get_kernel()

    def test_ledger_goal_tree_executes(self):
        async def _run():
            uil = parse_to_uil("Ram ko balance kati ho")
            tree = build_goal_tree(uil, "Ram ko balance kati ho")
            ctx = KernelContext(
                session_id="sched-test",
                balance={"cash": 5000, "bank": 10000},
            )
            return await execute_goal_tree(tree, ctx, "Ram ko balance kati ho")

        result = asyncio.run(_run())
        self.assertTrue(result.get("ok"))
        self.assertGreaterEqual(len(result.get("step_results", {})), 1)

    def test_sell_goal_tree_has_steps(self):
        uil = parse_to_uil("Ram le 500 ko saman becheko")
        tree = build_goal_tree(uil, "Ram le 500 ko saman becheko")
        self.assertGreaterEqual(len(tree.steps), 2)


if __name__ == "__main__":
    unittest.main()
