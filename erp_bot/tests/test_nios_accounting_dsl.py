"""UIL → AccountingDSL roundtrip tests."""

from __future__ import annotations

import unittest

from src.nios.dsl.compilers.accounting_dsl import compile_from_uil, compile_sale
from src.nios.dsl.compilers.uil_compiler import compile_uil_pipeline


class AccountingDslTests(unittest.TestCase):
    def test_sale_balanced(self):
        prog = compile_sale(party="Ram", amount=500, vat_amount=65)
        self.assertTrue(prog.balanced)
        self.assertEqual(prog.action, "sell")

    def test_uil_sell_roundtrip(self):
        result = compile_uil_pipeline("Ram le 500 ko saman becheko")
        self.assertIn("uil", result)
        self.assertIn("accounting", result)
        self.assertEqual(result["uil"]["action"], "sell")

    def test_uil_pipeline_stages(self):
        result = compile_uil_pipeline("Ram lai 1000 udhaar")
        self.assertEqual(len(result["pipeline"]), 8)

    def test_uil_pipeline_policy(self):
        result = compile_uil_pipeline("VAT rate kati ho")
        self.assertIn("policy", result)
        self.assertTrue(result["policy"]["ok"])

    def test_uil_investment_pipeline(self):
        result = compile_uil_pipeline("NEPSE NABIL quote")
        self.assertIn("investment", result)
        if result["investment"]:
            self.assertTrue(result["investment"]["ok"])

    def test_compile_from_uil_purchase(self):
        uil = {
            "action": "purchase",
            "actor": {"party": "Shyam"},
            "object": {"item": "rice", "amount": 1000},
            "financial_effect": {"amount": 1000},
            "tax_effect": {"vat": 130},
        }
        prog = compile_from_uil(uil)
        self.assertTrue(prog.balanced)
        self.assertEqual(prog.party, "Shyam")


if __name__ == "__main__":
    unittest.main()
