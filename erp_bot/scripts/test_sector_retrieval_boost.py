#!/usr/bin/env python3
"""Regression tests for sector-aware KB retrieval boost."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.knowledge.knowledge_registry import search_tiered_knowledge
from src.knowledge.sector_profile import (
    compute_sector_boost,
    detect_sector_slug_from_text,
    resolve_sector_slug,
)
from src.nlu.knowledge_enrich import search_nlu_knowledge


def test_resolve_sector_slug_variants() -> None:
    assert resolve_sector_slug("mobile-repair-shop") == "mobile-repair-shop"
    assert resolve_sector_slug("general.sector.paint-shop") == "paint-shop"
    assert resolve_sector_slug("retail_kirana") == "kirana-grocery"
    assert resolve_sector_slug({"id": "mobile-repair-shop"}) == "mobile-repair-shop"
    assert resolve_sector_slug("Mobile Repair Shop") == "mobile-repair-shop"


def test_detect_sector_from_message() -> None:
    assert detect_sector_slug_from_text("screen change gareko 2500 cash ma") == (
        "mobile-repair-shop"
    )
    assert detect_sector_slug_from_text("Ram lai paint becheko") == "paint-shop"
    assert detect_sector_slug_from_text("hello namaste") is None


def test_sector_boost_prefers_matching_segment() -> None:
    msg = "screen change gareko 2500 cash ma"
    without = search_nlu_knowledge(msg, top_k=5)
    with_boost = search_nlu_knowledge(
        msg, top_k=5, sector_profile="mobile-repair-shop"
    )

    without_sector = [h for h in without if h.id.startswith("sector-")]
    with_sector = [h for h in with_boost if h.id.startswith("sector-")]

    assert with_sector, "expected sector chunks in boosted results"
    if without_sector and with_sector:
        assert with_sector[0].metadata.get("sector_slug") == "mobile-repair-shop"
        # Boosted run should rank a mobile-repair sector chunk first among sector hits
        assert with_sector[0].segment == "general.sector.mobile-repair-shop"

    top_boost = with_boost[0]
    assert (
        top_boost.segment.startswith("general.sector.mobile-repair-shop")
        or top_boost.id.startswith("sector-mobile-repair")
    )


def test_compute_sector_boost_magnitude() -> None:
    class _Chunk:
        segment = "general.sector.mobile-repair-shop"
        metadata = {"sector_slug": "mobile-repair-shop"}
        tags = ["mobile-repair-shop"]
        id = "sector-mobile-repair-shop-0001"

    boost = compute_sector_boost(_Chunk(), "mobile-repair-shop", task="nlu")
    assert boost >= 50.0


def test_tiered_search_sector_profile_param() -> None:
    hits = search_tiered_knowledge(
        "battery change 1200",
        task="nlu",
        top_k=3,
        min_relevance=0.2,
        sector_profile="mobile-repair-shop",
    )
    assert hits
    assert any(
        h.segment.startswith("general.sector.mobile-repair-shop")
        or h.metadata.get("sector_slug") == "mobile-repair-shop"
        for h in hits
    )


def main() -> int:
    tests = [
        test_resolve_sector_slug_variants,
        test_detect_sector_from_message,
        test_sector_boost_prefers_matching_segment,
        test_compute_sector_boost_magnitude,
        test_tiered_search_sector_profile_param,
    ]
    failed = 0
    for fn in tests:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except AssertionError as exc:
            failed += 1
            print(f"FAIL {fn.__name__}: {exc}")
        except Exception as exc:
            failed += 1
            print(f"ERROR {fn.__name__}: {exc}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
