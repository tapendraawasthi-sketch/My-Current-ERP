#!/usr/bin/env python3
"""Tests for hybrid NLU search (lexical + embeddings RRF)."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest import mock

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

from src.knowledge.knowledge_registry import KnowledgeChunk
from src.nlu.hybrid_nlu_search import RRF_K, _rrf, hybrid_search_nlu


def test_rrf_formula() -> None:
    assert _rrf(0) > _rrf(5) > _rrf(20)


def test_hybrid_falls_back_to_lexical_when_no_embeddings() -> None:
    with mock.patch(
        "src.nlu.hybrid_nlu_search.search_nlu_embeddings",
        return_value=[],
    ):
        hits = hybrid_search_nlu("Ram lai 500 udhaar diye", top_k=3)
    assert hits
    assert all(isinstance(h, KnowledgeChunk) for h in hits)


def test_hybrid_merges_dense_hit() -> None:
    from src.nlu import hybrid_nlu_search as mod

    index = mod._chunk_index()
    sector_chunk = next(
        (c for c in index.values() if c.id.startswith("sector-mobile-repair")),
        None,
    )
    if not sector_chunk:
        print("SKIP test_hybrid_merges_dense_hit: no mobile-repair chunk")
        return

    dense_hit = {
        "id": sector_chunk.id,
        "text": "screen change",
        "distance": 0.1,
        "metadata": sector_chunk.metadata,
        "semantic_score": 0.9,
    }

    with mock.patch(
        "src.nlu.hybrid_nlu_search.search_nlu_embeddings",
        return_value=[dense_hit],
    ):
        hits = hybrid_search_nlu(
            "screen change gareko 2500",
            top_k=5,
            sector_profile="mobile-repair-shop",
        )

    ids = [h.id for h in hits]
    assert sector_chunk.id in ids


def test_search_nlu_knowledge_entrypoint() -> None:
    from src.nlu.knowledge_enrich import search_nlu_knowledge

    hits = search_nlu_knowledge("cash ma bikri 5000", top_k=3)
    assert len(hits) <= 3
    assert hits


def main() -> int:
    tests = [
        test_rrf_formula,
        test_hybrid_falls_back_to_lexical_when_no_embeddings,
        test_hybrid_merges_dense_hit,
        test_search_nlu_knowledge_entrypoint,
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
