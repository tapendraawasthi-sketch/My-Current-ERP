"""ERP engine deterministic tests."""

from __future__ import annotations

import unittest

from src.nios.execution.engines.erp_engine import (
    aging_report,
    balance_sheet,
    execute_erp_capability,
    ledger_balance,
    profit_loss,
    trial_balance,
)

BALANCE = {
    "cash": 100_000,
    "bank": 250_000,
    "receivable": 80_000,
    "payable": 50_000,
    "inventory": 120_000,
    "revenue": 500_000,
    "expense": 350_000,
}


class ErpEngineTests(unittest.TestCase):
    def test_ledger_balance(self):
        r = ledger_balance(BALANCE)
        self.assertTrue(r["ok"])
        self.assertIn("Cash", r["summary"])

    def test_trial_balance(self):
        r = trial_balance(BALANCE)
        self.assertIn("total_debit", r)
        self.assertIn("total_credit", r)

    def test_profit_loss(self):
        r = profit_loss(BALANCE)
        self.assertEqual(r["gross_profit"], 150_000)

    def test_balance_sheet(self):
        r = balance_sheet(BALANCE)
        self.assertGreater(r["assets"], r["liabilities"])

    def test_aging_report(self):
        r = aging_report(BALANCE)
        self.assertIn("buckets", r)

    def test_execute_capability_trial(self):
        r = execute_erp_capability("cap.erp.trial_balance", {"balance": BALANCE})
        self.assertIn("balanced", r)


if __name__ == "__main__":
    unittest.main()
