"""Feed refresh and normalization tests."""

from __future__ import annotations

import unittest

from src.nios.knowledge.feeds import (
    _normalize_nepse_payload,
    gov_search,
    nepse_quote,
    refresh_feeds,
)


class FeedsTests(unittest.TestCase):
    def test_refresh_bootstrap(self):
        result = refresh_feeds(live=False)
        self.assertIn("nepse", result)
        self.assertGreaterEqual(len(result["nepse"]), 5)

    def test_nepse_quote(self):
        refresh_feeds(live=False)
        q = nepse_quote("NABIL")
        self.assertIsNotNone(q)
        self.assertIn("ltp", q)

    def test_gov_search_vat(self):
        refresh_feeds(live=False)
        hits = gov_search("vat rate", topic="vat")
        self.assertGreaterEqual(len(hits), 1)

    def test_normalize_nepse_list(self):
        data = [{"symbol": "NABIL", "ltp": 630, "pe": 14, "sector": "Bank"}]
        out = _normalize_nepse_payload(data)
        self.assertIn("NABIL", out)
        self.assertEqual(out["NABIL"]["ltp"], 630.0)


if __name__ == "__main__":
    unittest.main()
