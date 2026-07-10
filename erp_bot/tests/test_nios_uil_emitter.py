"""UIL emitter roundtrip tests."""

from __future__ import annotations

import unittest

from src.nios.representations.uil_emitter import emit_from_uil, roundtrip_check
from src.nios.representations.uil_parser import parse_to_uil


class UilEmitterTests(unittest.TestCase):
    def test_emit_sell(self):
        uil = parse_to_uil("Ram le 500 ko chawal becheko")
        text = emit_from_uil(uil)
        self.assertIn("Ram", text)
        self.assertEqual(uil.action, "sell")

    def test_emit_balance(self):
        uil = parse_to_uil("Ram ko balance kati ho")
        text = emit_from_uil(uil)
        self.assertIn("balance", text.lower())

    def test_roundtrip_action_preserved(self):
        for msg in ("Ram le 1000 becheko", "VAT calculate garnu", "cash balance"):
            rt = roundtrip_check(msg)
            self.assertTrue(rt["action_preserved"], msg)


if __name__ == "__main__":
    unittest.main()
