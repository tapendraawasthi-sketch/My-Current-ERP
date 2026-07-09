"""Phase 4 — Tests for the Khata Entry Engine."""

import pytest
from datetime import date

from erp_bot.src.khata.khata_parser import ParsedEntry, EntryType, Direction, _regex_parse, _extract_amount, _extract_party
from erp_bot.src.khata.khata_validator import JournalEntry, JournalLine, generate_journal_entry, validate_journal, validate_balance


class TestAmountExtraction:
    def test_simple_number(self):
        assert _extract_amount("5000") == 5000
        assert _extract_amount("amount is 1500") == 1500
    
    def test_with_currency(self):
        assert _extract_amount("Rs. 5000") == 5000
        assert _extract_amount("रु. 2500") == 2500


class TestPartyExtraction:
    def test_capitalized_name(self):
        assert _extract_party("Ram lai 5000") == "Ram"
    
    def test_quoted_name(self):
        assert _extract_party('"Hari Prasad" lai') == "Hari Prasad"


class TestRegexParsing:
    def test_credit_sale_romanized(self):
        result = _regex_parse("Ram lai 5000 udhaar diye")
        assert result is not None
        assert result.amount == 5000
        assert result.party == "Ram"
        assert result.entry_type == EntryType.CREDIT_SALE
        assert result.direction == Direction.OUTWARD
    
    def test_payment_received(self):
        result = _regex_parse("Shyam bata 10000 liye")
        assert result is not None
        assert result.amount == 10000
        assert result.entry_type == EntryType.PAYMENT_RECEIVED
        assert result.direction == Direction.INWARD


class TestJournalGeneration:
    def test_credit_sale_journal(self):
        parsed = ParsedEntry(party="Ram", amount=5000, direction=Direction.OUTWARD, entry_type=EntryType.CREDIT_SALE, narration="test")
        journal = generate_journal_entry(parsed)
        
        assert len(journal.lines) == 2
        assert journal.total_debit == 5000
        assert journal.total_credit == 5000
        assert journal.is_balanced
        assert journal.lines[0].debit == 5000
        assert journal.lines[1].credit == 5000


class TestJournalValidation:
    def test_balanced_passes(self):
        journal = JournalEntry(
            lines=[JournalLine(account="Cash", debit=1000, credit=0), JournalLine(account="Sales", debit=0, credit=1000)],
            narration="Test", date=date.today().isoformat(), party=None, amount=1000, entry_type="cash_sale",
            total_debit=1000, total_credit=1000, is_balanced=True,
        )
        is_valid, errors = validate_journal(journal)
        assert is_valid
    
    def test_unbalanced_fails(self):
        journal = JournalEntry(
            lines=[JournalLine(account="Cash", debit=1000, credit=0), JournalLine(account="Sales", debit=0, credit=900)],
            narration="Test", date=date.today().isoformat(), party=None, amount=1000, entry_type="cash_sale",
            total_debit=1000, total_credit=900, is_balanced=False,
        )
        is_valid, err = validate_balance(journal)
        assert not is_valid


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
