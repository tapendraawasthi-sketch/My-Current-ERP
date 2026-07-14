"""Regression tests — permanent Romanized Nepali shop-speech layer."""

from __future__ import annotations

import pytest

from src.khata.purchase_draft import extract_purchase_fields, is_purchase_message
from src.nlu.text_normalize import normalize_accounting_text
from src.oip.integration.nepali_shop_nlu import (
    canonicalize_shop_message,
    handle_shop_nlu,
    is_greeting_message,
    is_party_balance_query,
)
from src.oip.integration.khata_preprocess import preprocess_erp_message
from src.orbix.operation_classifier import OperationClass, classify_operation


def test_normalize_collapses_purchase_and_unit_variants():
    assert "kineko" in normalize_accounting_text("maile chiura kinye 4 kilo")
    assert "kg" in normalize_accounting_text("maile chiura kinye 4 kilo")
    assert normalize_accounting_text("k xa").endswith("cha") or "cha" in normalize_accounting_text(
        "k xa"
    )


def test_canonicalize_strips_fillers():
    c = canonicalize_shop_message("maile chiura kinye 4 kilo")
    assert "maile" not in c
    assert "kineko" in c
    assert "kg" in c


@pytest.mark.parametrize(
    "msg",
    ["k xa", "k cha", "kasto cha", "halkhabar", "namaste", "hello"],
)
def test_greetings_detected(msg):
    assert is_greeting_message(msg)


def test_greeting_preprocess_skips_llm():
    result = preprocess_erp_message("k xa", session_id="t1")
    assert result is not None
    assert result.skip_llm is True
    assert result.intent == "greeting"
    assert "Orbix" in result.text or "hisab" in result.text.lower()


def test_purchase_kinye_item_before_verb():
    text = "maile chiura kinye 4 kilo"
    assert is_purchase_message(text)
    fields = extract_purchase_fields(text)
    assert fields.get("quantity") is not None
    assert float(fields["quantity"]) == 4.0
    assert fields.get("unit") == "kg"
    assert fields.get("item") and "chiura" in fields["item"]["name"].lower()


def test_classifier_marks_kinye_as_purchase():
    c = classify_operation("maile chiura kinye 4 kilo")
    assert c.operation_class == OperationClass.TRANSACTION_CREATE
    assert c.intent_hint == "purchase_entry"


def test_party_balance_query_patterns():
    assert is_party_balance_query("maile sweta lai kati dinu xa?")
    assert is_party_balance_query("paisa kati tirnu xa k")
    assert is_party_balance_query("Ram ko baki")


def test_party_balance_with_last_party_followup(monkeypatch):
    from src.oip.integration import nepali_shop_nlu as shop

    def fake_balance(party_name, session_id=None):
        return {
            "party": party_name,
            "net_balance": -1500.0,
            "total_receivable": 0,
            "total_payable": 1500.0,
            "source": "session_snapshot",
        }

    monkeypatch.setattr(shop, "query_party_balance", fake_balance)
    monkeypatch.setattr(shop, "set_active_session", lambda *_a, **_k: None)

    hit = handle_shop_nlu(
        "paisa kati tirnu xa k",
        session_id="s1",
        last_party="Sweta",
    )
    assert hit is not None
    assert hit.skip_llm is True
    assert hit.party == "Sweta"
    assert "1500" in hit.text or "1,500" in hit.text


def test_party_named_obligation(monkeypatch):
    from src.oip.integration import nepali_shop_nlu as shop

    def fake_balance(party_name, session_id=None):
        return {
            "party": "Sweta",
            "net_balance": -200.0,
            "total_receivable": 0,
            "total_payable": 200.0,
            "source": "session_snapshot",
        }

    monkeypatch.setattr(shop, "query_party_balance", fake_balance)
    monkeypatch.setattr(shop, "set_active_session", lambda *_a, **_k: None)

    hit = handle_shop_nlu("maile sweta lai kati dinu xa?", session_id="s1")
    assert hit is not None
    assert hit.skip_llm is True
    assert "Sweta" in hit.text
    assert "days" not in hit.text.lower()


def test_preprocess_purchase_routes_to_mode_aware():
    # Ask mode: purchase should be mode-restricted or draft — not LLM encyclopedia
    result = preprocess_erp_message(
        "maile chiura kinye 4 kilo",
        orbix_mode="ask",
        session_id="t-purchase",
    )
    assert result is not None
    # Either skip_llm with restriction/clarification, or mode_aware handled it
    assert result.method in {
        "mode_aware",
        "mode_policy",
        "nepali_shop_nlu",
        "erp_preprocess",
        "purchase_draft",
    } or result.skip_llm is True or result.intent in {
        "purchase_entry",
        "mode_restriction",
        "transaction_create",
    }
