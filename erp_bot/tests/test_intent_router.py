"""Phase 2 — Tests for the intent router.

These tests verify:
1. Regex fast-path for high-confidence patterns
2. Intent classification accuracy
3. Routing logic (needs_rag, needs_parser, etc.)
"""

import pytest
from erp_bot.src.agent.intent_router import (
    _regex_fastpath,
    classify_intent_sync,
    Intent,
    RouteDecision,
    get_rag_query,
    should_skip_tools,
    to_legacy_intent,
)


class TestRegexFastpath:
    """Test the regex fast-path classifier."""
    
    def test_chitchat_greetings_english(self):
        """English greetings should be classified as chitchat."""
        for text in ["hello", "hi", "hey", "good morning", "thanks", "bye"]:
            result = _regex_fastpath(text)
            assert result is not None, f"'{text}' should match"
            assert result.intent == "chitchat"
            assert result.confidence >= 0.90
            assert result.method == "regex_fastpath"
    
    def test_chitchat_greetings_nepali(self):
        """Nepali/Romanized greetings should be classified as chitchat."""
        for text in ["namaste", "namaskar", "k cha", "kasto cha", "khana khayeu"]:
            result = _regex_fastpath(text)
            assert result is not None, f"'{text}' should match"
            assert result.intent == "chitchat"
    
    def test_chitchat_devanagari(self):
        """Devanagari greetings should be classified as chitchat."""
        for text in ["नमस्ते", "नमस्कार", "के छ"]:
            result = _regex_fastpath(text)
            assert result is not None, f"'{text}' should match"
            assert result.intent == "chitchat"
    
    def test_khata_entry_with_amount(self):
        """Transaction phrases with amounts should be khata_entry."""
        texts = [
            "Ram lai 5000 udhaar diye",
            "Shyam bata 10000 tireko",
            "customer lai Rs 2500 ko saman becheko",
            "supplier lai 50000 paisa diye",
        ]
        for text in texts:
            result = _regex_fastpath(text)
            assert result is not None, f"'{text}' should match"
            assert result.intent == "khata_entry"
            assert result.confidence >= 0.85
    
    def test_khata_without_amount_no_match(self):
        """Transaction phrases without amounts should NOT fast-path match."""
        # These need LLM to determine if they're transactions
        result = _regex_fastpath("Ram lai udhaar diye")
        # No amount → regex confidence too low or no match
        assert result is None or result.confidence < 0.85
    
    def test_code_questions(self):
        """Developer questions should be classified as code_qa."""
        texts = [
            "Which component handles the invoice form?",
            "How is the sales report implemented?",
            "Where in the code is the ledger calculated?",
            "What's the database schema for parties?",
        ]
        for text in texts:
            result = _regex_fastpath(text)
            assert result is not None, f"'{text}' should match"
            assert result.intent == "code_qa"
    
    def test_erp_navigation(self):
        """ERP navigation questions should be erp_howto."""
        texts = [
            "where is journal entry?",
            "how to open payment voucher?",
            "shortcut for ledger report",
            "journal voucher kahile garnu parchha?",
        ]
        for text in texts:
            result = _regex_fastpath(text)
            assert result is not None, f"'{text}' should match"
            assert result.intent == "erp_howto"
    
    def test_accounting_questions(self):
        """Nepal accounting questions should be accounting_qa."""
        texts = [
            "VAT rate Nepal ma kati ho?",
            "TDS rate for professional services?",
            "What is the SSF contribution rate?",
            "journal entry for depreciation",
        ]
        for text in texts:
            result = _regex_fastpath(text)
            assert result is not None, f"'{text}' should match"
            assert result.intent == "accounting_qa"
    
    def test_ambiguous_no_fastpath(self):
        """Ambiguous questions should NOT match fast-path."""
        texts = [
            "What is this?",
            "Help me",
            "I have a question",
            "Can you explain?",
        ]
        for text in texts:
            result = _regex_fastpath(text)
            # Should return None (need LLM) or low confidence
            assert result is None or result.confidence < 0.80


class TestRouteDecision:
    """Test RouteDecision properties."""
    
    def test_needs_rag(self):
        """Test needs_rag property for different intents."""
        assert RouteDecision("accounting_qa", 0.9, "test", "").needs_rag is True
        assert RouteDecision("erp_howto", 0.9, "test", "").needs_rag is True
        assert RouteDecision("code_qa", 0.9, "test", "").needs_rag is True
        assert RouteDecision("chitchat", 0.9, "test", "").needs_rag is False
        assert RouteDecision("general_qa", 0.9, "test", "").needs_rag is False
        assert RouteDecision("khata_entry", 0.9, "test", "").needs_rag is False
    
    def test_needs_parser(self):
        """Test needs_parser property."""
        assert RouteDecision("khata_entry", 0.9, "test", "").needs_parser is True
        assert RouteDecision("chitchat", 0.9, "test", "").needs_parser is False
        assert RouteDecision("accounting_qa", 0.9, "test", "").needs_parser is False
    
    def test_rag_collection(self):
        """Test rag_collection property."""
        assert RouteDecision("accounting_qa", 0.9, "test", "").rag_collection == "knowledge"
        assert RouteDecision("erp_howto", 0.9, "test", "").rag_collection == "code"
        assert RouteDecision("code_qa", 0.9, "test", "").rag_collection == "code"
        assert RouteDecision("chitchat", 0.9, "test", "").rag_collection is None


class TestHelperFunctions:
    """Test helper functions."""
    
    def test_should_skip_tools(self):
        """Test should_skip_tools for different intents."""
        assert should_skip_tools("chitchat") is True
        assert should_skip_tools("general_qa") is False
        assert should_skip_tools("code_qa") is False
    
    def test_get_rag_query(self):
        """Test RAG query generation."""
        assert get_rag_query("What is VAT?", "accounting_qa") == "What is VAT?"
        assert get_rag_query("where is journal entry?", "erp_howto") is not None
        assert get_rag_query("hello", "chitchat") is None
    
    def test_to_legacy_intent(self):
        """Test legacy intent mapping."""
        assert to_legacy_intent("chitchat") == "general"
        assert to_legacy_intent("general_qa") == "general"
        assert to_legacy_intent("accounting_qa") == "effect"
        assert to_legacy_intent("erp_howto") == "nav"
        assert to_legacy_intent("khata_entry") == "action_path"
        assert to_legacy_intent("code_qa") == "code"


class TestIntentEnum:
    """Test Intent enum."""
    
    def test_all_intents_exist(self):
        """Verify all expected intents are defined."""
        expected = {"chitchat", "general_qa", "accounting_qa", "erp_howto", "khata_entry", "code_qa"}
        actual = {i.value for i in Intent}
        assert actual == expected


# Integration tests (require Ollama to be running)
@pytest.mark.skipif(True, reason="Requires Ollama to be running")
class TestLLMClassification:
    """Integration tests for LLM-based classification."""
    
    @pytest.mark.asyncio
    async def test_classify_greeting(self):
        """Test LLM classification of greetings."""
        from erp_bot.src.agent.intent_router import classify_intent
        result = await classify_intent("namaste, kasto cha?", use_llm_always=True)
        assert result.intent == "chitchat"
        assert result.method == "llm"
    
    @pytest.mark.asyncio
    async def test_classify_accounting(self):
        """Test LLM classification of accounting questions."""
        from erp_bot.src.agent.intent_router import classify_intent
        result = await classify_intent("What is the TDS rate in Nepal?", use_llm_always=True)
        assert result.intent == "accounting_qa"
    
    @pytest.mark.asyncio
    async def test_classify_khata(self):
        """Test LLM classification of khata entries."""
        from erp_bot.src.agent.intent_router import classify_intent
        result = await classify_intent("Ram lai 5000 udhaar diye", use_llm_always=True)
        assert result.intent == "khata_entry"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
