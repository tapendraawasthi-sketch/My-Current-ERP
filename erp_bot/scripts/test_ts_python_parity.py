#!/usr/bin/env python3
"""TS/Python vocabulary parity smoke tests (shared JSON source)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
BOT_ROOT = ROOT / "erp_bot"
sys.path.insert(0, str(BOT_ROOT))

from src.knowledge.vocabulary_loader import (
    get_all_business_terms,
    get_merged_spelling_aliases,
    get_payment_aliases,
)
from src.nlu.text_normalize import normalize_accounting_text

VOCAB_ROOT = ROOT / "data" / "ekhata" / "vocabulary"
MASTER = VOCAB_ROOT / "master.json"
REGISTRY = VOCAB_ROOT / "_registry.json"


def test_master_json_exists() -> None:
    assert MASTER.exists(), "Run build_vocabulary_master.py first"
    data = json.loads(MASTER.read_text(encoding="utf-8"))
    assert data["term_count"] >= 500
    assert data["spelling_alias_count"] >= 50


def test_registry_category_count() -> None:
    reg = json.loads(REGISTRY.read_text(encoding="utf-8"))
    assert len(reg.get("categories") or []) >= 20


def test_spelling_aliases_loaded() -> None:
    aliases = get_merged_spelling_aliases()
    assert aliases.get("bechye") == "becheko"
    assert aliases.get("eutako") == "euta ko"


def test_normalize_matches_vocab() -> None:
    norm = normalize_accounting_text("bechye 500 nagad ma")
    assert "becheko" in norm
    assert "cash" in norm


def test_payment_aliases_parity_keys() -> None:
    master = json.loads(MASTER.read_text(encoding="utf-8"))
    py_aliases = get_payment_aliases()
    master_pay = master.get("payment_aliases") or {}
    for key in ("cash", "nagad", "esewa", "khalti", "fonepay", "cheque"):
        assert key in py_aliases
        assert key in master_pay
        assert py_aliases[key] == master_pay[key]


def test_business_terms_count() -> None:
    terms = get_all_business_terms()
    assert len(terms) >= 500


def main() -> int:
    tests = [
        test_master_json_exists,
        test_registry_category_count,
        test_spelling_aliases_loaded,
        test_normalize_matches_vocab,
        test_payment_aliases_parity_keys,
        test_business_terms_count,
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
