#!/usr/bin/env python3
"""Tests for nearest-neighbor intent classifier."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.nlu.engine import ParsedEntry, get_nlu_engine
from src.nlu.hybrid_nlu_search import hybrid_search_nlu_scored
from src.nlu.nearest_neighbor_intent import (
    apply_neighbor_to_parsed,
    find_best_neighbor,
    parse_with_nearest_neighbor,
    score_neighbor_match,
    text_similarity,
)
from src.nlu.knowledge_enrich import SECTOR_INTENT_TO_NLU, enrich_parsed_entry


def test_text_similarity_identical() -> None:
    a = "Screen replace garya, 2500 liyo cash ma"
    assert text_similarity(a, a) >= 0.95


def test_text_similarity_partial() -> None:
    sim = text_similarity(
        "screen change gareko 2500 cash",
        "Screen replace garya, 2500 liyo cash ma",
    )
    assert sim >= 0.35


def test_find_neighbor_on_sector_example() -> None:
    hits = hybrid_search_nlu_scored(
        "Screen replace garya, 2500 liyo cash ma",
        top_k=5,
        sector_profile="mobile-repair-shop",
    )
    match = find_best_neighbor(
        "Screen replace garya, 2500 liyo cash ma",
        hits,
        sector_slug="mobile-repair-shop",
        intent_map=SECTOR_INTENT_TO_NLU,
    )
    assert match is not None
    assert match.similarity >= 0.72
    assert match.nlu_intent is not None


def test_apply_neighbor_sets_intent() -> None:
    hits = hybrid_search_nlu_scored(
        "Screen replace garya, 2500 liyo cash ma",
        top_k=3,
        sector_profile="mobile-repair-shop",
    )
    match = find_best_neighbor(
        "Screen replace garya, 2500 liyo cash ma",
        hits,
        sector_slug="mobile-repair-shop",
        intent_map=SECTOR_INTENT_TO_NLU,
    )
    assert match is not None
    parsed = ParsedEntry(
        intent="unknown",
        narration="Screen replace garya, 2500 liyo cash ma",
        confidence=0.4,
        amount=2500.0,
        payment_method="cash",
    )
    updated = apply_neighbor_to_parsed(parsed, match, message=parsed.narration)
    assert updated.intent != "unknown"
    assert updated.confidence >= 0.72


def test_parse_with_neighbor_skips_unknown() -> None:
    parsed = parse_with_nearest_neighbor(
        "Screen replace garya, 2500 liyo cash ma",
        {"business_sector_slug": "mobile-repair-shop"},
    )
    assert parsed is not None
    assert parsed.intent != "unknown"
    assert parsed.confidence >= 0.78


def test_enrich_uses_neighbor() -> None:
    parsed = ParsedEntry(
        intent="unknown",
        narration="Screen replace garya, 2500 liyo cash ma",
        confidence=0.3,
        amount=2500.0,
        payment_method="cash",
    )
    enriched = enrich_parsed_entry(
        parsed,
        parsed.narration,
        sector_profile="mobile-repair-shop",
    )
    assert enriched.intent != "unknown"


def test_engine_nn_before_llm() -> None:
    engine = get_nlu_engine()
    parsed = engine.parse(
        "Screen replace garya, 2500 liyo cash ma",
        {"business_sector_slug": "mobile-repair-shop", "session_id": "nn-test"},
    )
    assert parsed.intent != "unknown"
    assert parsed.confidence >= 0.72


def main() -> int:
    tests = [
        test_text_similarity_identical,
        test_text_similarity_partial,
        test_find_neighbor_on_sector_example,
        test_apply_neighbor_sets_intent,
        test_parse_with_neighbor_skips_unknown,
        test_enrich_uses_neighbor,
        test_engine_nn_before_llm,
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
