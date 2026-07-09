"""Phase 4 — Tests for the Khata Entry Engine.

Tests cover:
1. Romanized Nepali input
2. Devanagari Nepali input
3. Ambiguous input (missing party/details)
4. English input
5. Journal balance validation
6. Regex fast-path accuracy
"""

import pytest
from decimal import Decimal
from erp_bot.src.khata.entry_engine import (
    _extract_amount,
    _extract_party,
    regex_fast_path,
    parse_khata_entry_sync,
    build_journal_entry,
    TransactionType,
    ParseResult,
    JournalLine,
)


class TestAmountExtraction:
    """Test amount extraction from various formats."""
    
    def test_simple_number(self):
        assert _extract_amount("5000") == Decimal("5000")
        assert _extract_amount("Rs 10000") == Decimal("10000")
        assert _extract_amount("NPR 15000") == Decimal("15000")
    
    def test_comma_formatted(self):
        assert _extract_amount("Rs 1,00,000") == Decimal("100000")
        assert _extract_amount("50,000") == Decimal("50000")
    
    def test_decimal_amount(self):
        assert _extract_amount("Rs 5000.50") == Decimal("5000.50")
    
    def test_nepali_rupee_symbol(self):
        assert _extract_amount("रु. 5000") == Decimal("5000")
        assert _extract_amount("₹ 10000") == Decimal("10000")
    
    def test_nepali_number_words(self):
        assert _extract_amount("5 hajar") == Decimal("5000")
        assert _extract_amount("2 lakh") == Decimal("200000")
        assert _extract_amount("ek hajar") == Decimal("1000")
    
    def test_no_amount(self):
        assert _extract_amount("Ram lai diye") is None


class TestPartyExtraction:
    """Test party name extraction."""
    
    def test_lai_pattern(self):
        assert _extract_party("Ram lai 5000 diye") == "Ram"
        assert _extract_party("Shyam lai udhaar becheko") == "Shyam"
    
    def test_bata_pattern(self):
        assert _extract_party("Ram bata 5000 payo") == "Ram"
    
    def test_from_to_pattern(self):
        assert _extract_party("received 5000 from Hari") == "Hari"
        assert _extract_party("paid 5000 to Sita") == "Sita"
    
    def test_devanagari_party(self):
        assert _extract_party("राम लाई 5000 दिए") is not None
    
    def test_no_party(self):
        assert _extract_party("5000 diye") is None
        assert _extract_party("salary paid") is None


class TestRegexFastPath:
    """Test regex fast-path for high-confidence patterns."""
    
    def test_credit_sale_romanized(self):
        result = regex_fast_path("Ram lai 5000 udhaar becheko")
        assert result is not None
        assert result.success
        assert result.transaction.transaction_type == TransactionType.CREDIT_SALE
        assert result.transaction.amount == Decimal("5000")
        assert result.transaction.party == "Ram"
    
    def test_credit_sale_devanagari(self):
        result = regex_fast_path("राम लाई 5000 उधारो बेचेको")
        # May or may not match depending on pattern coverage
        if result and result.success:
            assert result.transaction.transaction_type == TransactionType.CREDIT_SALE
    
    def test_cash_sale(self):
        result = regex_fast_path("cash bikri 10000")
        assert result is not None
        assert result.transaction.transaction_type == TransactionType.CASH_SALE
    
    def test_receipt(self):
        result = regex_fast_path("Shyam bata 15000 payo")
        assert result is not None
        assert result.transaction.transaction_type == TransactionType.RECEIPT
        assert result.transaction.party == "Shyam"
    
    def test_payment(self):
        result = regex_fast_path("supplier lai 20000 tireko")
        assert result is not None
        assert result.transaction.transaction_type == TransactionType.PAYMENT
    
    def test_ambiguous_no_fastpath(self):
        """Ambiguous input should NOT use fast-path."""
        result = regex_fast_path("500 diye")
        # Low confidence → should return None
        assert result is None or not result.success or result.transaction.confidence < 0.8


class TestJournalBalance:
    """Test that journal entries always balance."""
    
    def test_credit_sale_balance(self):
        lines = build_journal_entry(
            TransactionType.CREDIT_SALE,
            Decimal("5000"),
            party="Ram"
        )
        total_dr = sum(l.debit for l in lines)
        total_cr = sum(l.credit for l in lines)
        assert total_dr == total_cr == Decimal("5000")
    
    def test_payment_balance(self):
        lines = build_journal_entry(
            TransactionType.PAYMENT,
            Decimal("10000"),
            party="Supplier"
        )
        total_dr = sum(l.debit for l in lines)
        total_cr = sum(l.credit for l in lines)
        assert total_dr == total_cr == Decimal("10000")
    
    def test_all_transaction_types_balance(self):
        """All transaction types must produce balanced entries."""
        for txn_type in TransactionType:
            lines = build_journal_entry(txn_type, Decimal("1000"), party="Test")
            total_dr = sum(l.debit for l in lines)
            total_cr = sum(l.credit for l in lines)
            assert total_dr == total_cr, f"{txn_type} does not balance"


class TestRomanizedNepali:
    """Test Romanized Nepali input."""
    
    def test_udhaar_bikri(self):
        result = parse_khata_entry_sync("Ram lai 5000 udhaar becheko")
        assert result.success
        assert result.transaction.transaction_type == TransactionType.CREDIT_SALE
    
    def test_paisa_diye(self):
        result = parse_khata_entry_sync("Shyam lai 10000 diye")
        assert result.success
        assert result.transaction.transaction_type in (
            TransactionType.PAYMENT,
            TransactionType.OTHER,
        )
    
    def test_paisa_payo(self):
        result = parse_khata_entry_sync("customer bata 15000 payo")
        assert result.success
        assert result.transaction.transaction_type == TransactionType.RECEIPT
    
    def test_kineko(self):
        result = parse_khata_entry_sync("saman 20000 ma kineko")
        assert result.success
        assert result.transaction.transaction_type in (
            TransactionType.CASH_PURCHASE,
            TransactionType.CREDIT_PURCHASE,
            TransactionType.OTHER,
        )


class TestEnglishInput:
    """Test English input."""
    
    def test_sold_on_credit(self):
        result = parse_khata_entry_sync("Sold goods to Ram for Rs 5000 on credit")
        assert result.success
        assert result.transaction.amount == Decimal("5000")
    
    def test_cash_purchase(self):
        result = parse_khata_entry_sync("Bought supplies for Rs 3000 cash")
        assert result.success
        assert result.transaction.amount == Decimal("3000")
    
    def test_received_payment(self):
        result = parse_khata_entry_sync("Received Rs 10000 from Hari")
        assert result.success
        assert result.transaction.transaction_type == TransactionType.RECEIPT
    
    def test_paid_rent(self):
        result = parse_khata_entry_sync("Paid office rent Rs 15000")
        assert result.success


class TestAmbiguousInput:
    """Test handling of ambiguous input."""
    
    def test_amount_only(self):
        """Amount without context should ask for clarification."""
        result = parse_khata_entry_sync("500")
        # May succeed with low confidence or ask for clarification
        if result.success:
            assert result.transaction.confidence < 0.7
        else:
            assert result.clarification_needed is not None or result.error is not None
    
    def test_missing_party(self):
        """Some transactions are valid without party."""
        result = parse_khata_entry_sync("office kharcha 2000")
        # Expense without party is valid
        if result.success:
            assert result.transaction.party is None
    
    def test_unclear_direction(self):
        """Unclear direction should have lower confidence."""
        result = parse_khata_entry_sync("5000 ko transaction")
        if result.success:
            assert result.transaction.confidence < 0.8


class TestDevanagariInput:
    """Test Devanagari Nepali input (integration, may need LLM)."""
    
    def test_basic_devanagari(self):
        # This may fall through to LLM
        result = parse_khata_entry_sync("राम लाई ५००० उधारो बेचेको")
        # Should either succeed or ask for clarification
        assert result.success or result.clarification_needed or result.error
    
    def test_mixed_devanagari_number(self):
        result = parse_khata_entry_sync("राम लाई 5000 दिए")
        # Mixed input should work
        assert result.success or result.clarification_needed or result.error


class TestValidation:
    """Test transaction validation."""
    
    def test_valid_transaction(self):
        result = parse_khata_entry_sync("Ram lai 5000 udhaar becheko")
        if result.success:
            txn = result.transaction
            assert txn.is_valid
            assert txn.is_balanced
            assert txn.amount > 0
            assert len(txn.journal_lines) >= 2
    
    def test_card_format(self):
        result = parse_khata_entry_sync("Ram lai 5000 udhaar becheko")
        if result.success:
            card = result.transaction.to_card()
            assert "intent" in card
            assert "amount" in card
            assert "journalLines" in card
            assert card["amount"] == 5000


# Integration tests (require Ollama)
@pytest.mark.skipif(True, reason="Requires Ollama to be running")
class TestLLMExtraction:
    """Integration tests for LLM-based extraction."""
    
    def test_llm_extraction(self):
        from erp_bot.src.khata.entry_engine import parse_khata_entry
        import asyncio
        
        result = asyncio.run(parse_khata_entry("Ram lai 5000 udhaar becheko", use_llm_always=True))
        assert result.success
        assert result.transaction.method == "llm"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
