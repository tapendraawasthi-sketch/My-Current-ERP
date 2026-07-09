#!/usr/bin/env python3
"""Basic smoke tests for QLoRA training scripts.

Run with: python -m pytest test_scripts.py -v
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest


# ══════════════════════════════════════════════════════════════════════════════
# CONVERT CORPUS TESTS
# ══════════════════════════════════════════════════════════════════════════════

def test_convert_corpus_import():
    """Test that convert_corpus can be imported."""
    from convert_corpus import (
        clean_text,
        convert_qa_to_alpaca,
        convert_transaction_to_alpaca,
        generate_synthetic_examples,
    )
    assert callable(clean_text)
    assert callable(convert_qa_to_alpaca)
    assert callable(convert_transaction_to_alpaca)
    assert callable(generate_synthetic_examples)


def test_clean_text():
    """Test text cleaning."""
    from convert_corpus import clean_text
    
    assert clean_text("  hello   world  ") == "hello world"
    assert clean_text("hello\\nworld") == "hello\nworld"


def test_convert_qa_to_alpaca():
    """Test Q&A conversion."""
    from convert_corpus import convert_qa_to_alpaca
    
    record = {
        "input": "What is VAT?",
        "output": "VAT is a consumption tax."
    }
    result = convert_qa_to_alpaca(record)
    
    assert result is not None
    assert result["instruction"] == "What is VAT?"
    assert result["output"] == "VAT is a consumption tax."
    assert result["input"] == ""


def test_convert_qa_to_alpaca_rejects_short():
    """Test that very short examples are rejected."""
    from convert_corpus import convert_qa_to_alpaca
    
    record = {"input": "hi", "output": "ok"}
    result = convert_qa_to_alpaca(record)
    assert result is None


def test_generate_synthetic_examples():
    """Test synthetic example generation."""
    from convert_corpus import generate_synthetic_examples
    
    examples = generate_synthetic_examples()
    assert len(examples) > 10
    
    # All should have required fields
    for ex in examples:
        assert "instruction" in ex
        assert "input" in ex
        assert "output" in ex


def test_convert_transaction_to_alpaca():
    """Test transaction conversion."""
    from convert_corpus import convert_transaction_to_alpaca
    
    record = {
        "narration": "Ram lai 5000 udhaar becheko",
        "intent": "khata_credit_sale",
        "party": "Ram",
        "amount": 5000,
        "journalLines": [
            {"accountName": "Accounts Receivable (Ram)", "debit": 5000, "credit": 0},
            {"accountName": "Sales Revenue", "debit": 0, "credit": 5000},
        ]
    }
    
    result = convert_transaction_to_alpaca(record)
    
    assert result is not None
    assert "Ram lai 5000 udhaar becheko" in result["instruction"]
    assert "DEBIT" in result["output"]
    assert "CREDIT" in result["output"]
    assert "5,000" in result["output"]


# ══════════════════════════════════════════════════════════════════════════════
# EVALUATE TESTS
# ══════════════════════════════════════════════════════════════════════════════

def test_evaluate_import():
    """Test that evaluate can be imported."""
    from evaluate import (
        check_journal_balance,
        check_language_match,
        calculate_bleu,
    )
    assert callable(check_journal_balance)
    assert callable(check_language_match)
    assert callable(calculate_bleu)


def test_check_journal_balance():
    """Test journal balance checking."""
    from evaluate import check_journal_balance
    
    # Balanced entry
    balanced = """
    DEBIT: Cash — Rs 5,000
    CREDIT: Sales — Rs 5,000
    """
    assert check_journal_balance(balanced) is True
    
    # Unbalanced entry
    unbalanced = """
    DEBIT: Cash — Rs 5,000
    CREDIT: Sales — Rs 3,000
    """
    assert check_journal_balance(unbalanced) is False
    
    # No journal entry
    no_entry = "Hello, how can I help you?"
    assert check_journal_balance(no_entry) is True


def test_check_language_match():
    """Test language matching."""
    from evaluate import check_language_match
    
    # Devanagari input should get Devanagari output
    assert check_language_match("राम लाई", "राम लाई रु ५,०००") is True
    assert check_language_match("राम लाई", "Ram Rs 5000") is False
    
    # Romanized input should get Romanized output
    assert check_language_match("udhaar becheko", "Credit sale, udhaar bikri") is True
    
    # English is flexible
    assert check_language_match("What is VAT?", "VAT is 13%") is True


def test_calculate_bleu_fallback():
    """Test BLEU calculation fallback."""
    from evaluate import calculate_bleu
    
    # With sacrebleu installed, this should work
    # Without it, fallback to word overlap
    score = calculate_bleu("hello world test", "hello world test")
    assert score > 0.5  # Should be high for identical
    
    score = calculate_bleu("hello world", "goodbye moon")
    assert score < 0.5  # Should be low for different


# ══════════════════════════════════════════════════════════════════════════════
# SAMPLE DATA TESTS
# ══════════════════════════════════════════════════════════════════════════════

def test_sample_data_valid():
    """Test that sample data is valid JSON."""
    sample_path = Path(__file__).parent / "example_data" / "sample_alpaca.json"
    
    with open(sample_path, encoding="utf-8") as f:
        data = json.load(f)
    
    assert len(data) > 0
    
    for item in data:
        assert "instruction" in item
        assert "input" in item
        assert "output" in item
        assert len(item["instruction"]) > 0
        assert len(item["output"]) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
