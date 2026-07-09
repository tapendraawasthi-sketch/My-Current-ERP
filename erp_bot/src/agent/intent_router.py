"""Phase 2 — Intent Router using qwen3:4b for fast classification.

Routes messages into:
- chitchat     → casual conversation, greetings → LLM directly
- general_qa   → general knowledge questions → LLM directly
- accounting_qa → Nepal tax/accounting questions → RAG(knowledge) → LLM
- erp_howto    → ERP navigation/how-to → RAG(code/nav index) → LLM
- khata_entry  → transaction entry ("Ram lai 5000 diye") → parser → LLM confirm
- code_qa      → developer questions about source code → RAG(code) → LLM

Architecture:
1. Regex pre-filter for cheap fast-path (~0ms) — high confidence only
2. LLM classification via qwen3:4b (~200-500ms) — final decision
3. Never trust regex alone for low-confidence matches
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from enum import Enum
from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from ..config import FAST_MODEL, FAST_MODEL_OPTIONS, OLLAMA_BASE_URL

logger = logging.getLogger(__name__)


class Intent(str, Enum):
    """Message intent categories for routing."""
    
    CHITCHAT = "chitchat"
    GENERAL_QA = "general_qa"
    ACCOUNTING_QA = "accounting_qa"
    ERP_HOWTO = "erp_howto"
    KHATA_ENTRY = "khata_entry"
    CODE_QA = "code_qa"


IntentType = Literal[
    "chitchat", "general_qa", "accounting_qa", "erp_howto", "khata_entry", "code_qa"
]


@dataclass
class RouteDecision:
    """Result of intent classification."""
    
    intent: IntentType
    confidence: float  # 0.0 to 1.0
    method: str  # "regex_fastpath" | "llm"
    reasoning: str  # Brief explanation
    
    @property
    def needs_rag(self) -> bool:
        """Whether this intent needs RAG retrieval before LLM."""
        return self.intent in ("accounting_qa", "erp_howto", "code_qa")
    
    @property
    def needs_parser(self) -> bool:
        """Whether this intent needs structured parsing."""
        return self.intent == "khata_entry"
    
    @property
    def rag_collection(self) -> str | None:
        """Which RAG collection to query, if any."""
        if self.intent == "accounting_qa":
            return "knowledge"  # Nepal tax/accounting knowledge base
        elif self.intent in ("erp_howto", "code_qa"):
            return "code"  # Codebase index
        return None


# ══════════════════════════════════════════════════════════════════════════════
# REGEX PRE-FILTER (fast-path for high-confidence matches)
# ══════════════════════════════════════════════════════════════════════════════

# Greetings and chitchat — very high confidence patterns
_CHITCHAT_PATTERNS = re.compile(
    r"^(namaste|namaskar|hello|hi|hey|good\s*(morning|afternoon|evening|night)|"
    r"k cha|kasto cha|khana khayeu|khai|ke cha|thik cha|"
    r"धन्यवाद|नमस्ते|नमस्कार|के छ|कस्तो छ|खान खायौ|ठिक छ|"
    r"thanks|thank you|bye|goodbye|see you|take care|"
    r"how are you|what'?s up|sup|yo)\s*[?!.]*$",
    re.IGNORECASE,
)

# Khata/transaction entry — Nepali money patterns
_KHATA_PATTERNS = re.compile(
    r"(udhaar|udharo|udhar|tireko|tire|diye|liye|paisa|rupees?|rs\.?|रु\.?|"
    r"baki|becheko|kineko|bhuktan|payment|received|paid|sold|bought|"
    r"उधारो?|तिरेको|दिए|लिए|पैसा|बाँकी|बेचेको|किनेको|भुक्तान)",
    re.IGNORECASE,
)

# Has a number (amount) — strong signal for khata
_HAS_AMOUNT = re.compile(r"\b\d{2,}(?:,\d{3})*(?:\.\d{2})?\b")

# Code/developer questions — technical keywords
_CODE_PATTERNS = re.compile(
    r"\b(code|function|component|hook|api|schema|database|implementation|"
    r"source\s*(file|code)|where in (the\s*)?code|how is .+ (implemented|built)|"
    r"typescript|\.tsx?|sql|query|table|column|backend|frontend|developer|"
    r"which (file|module|class)|renders?|supabase|rpc)\b",
    re.IGNORECASE,
)

# ERP navigation — where/how to access screens
_ERP_NAV_PATTERNS = re.compile(
    r"\b(where (is|do i|can i)|"
    r"how (do i |to |can i )?(open|access|find|go to|navigate|see|view)|"
    r"shortcut|hotkey|keyboard|menu (for|of)|path (to|for)|"
    r"journal|voucher|invoice|ledger|trial\s*balance|report|"
    r"कहाँ छ|कसरी|के गर्ने)\b",
    re.IGNORECASE,
)

# Nepal accounting/tax specific
_ACCOUNTING_PATTERNS = re.compile(
    r"\b(vat|tds|ssf|eis|cit|advance\s*tax|withholding|"
    r"income\s*tax|business\s*income|depreciation|"
    r"debit|credit|journal\s*entry|double\s*entry|accounting\s*(rule|standard|treatment)|"
    r"nepal\s*(tax|accounting)|ird|inland\s*revenue|"
    r"fiscal\s*year|shrawan|bhadra|ashadh|jestha|chaitra|"
    r"भ्याट|करको|आयकर|श्रावण|भद्र)\b",
    re.IGNORECASE,
)


def _regex_fastpath(text: str) -> RouteDecision | None:
    """Try to classify using regex for high-confidence patterns.
    
    Returns None if confidence is too low (should use LLM).
    Only returns a decision if pattern match is very clear.
    """
    text = text.strip()
    
    # Chitchat — greetings are very distinctive
    if _CHITCHAT_PATTERNS.match(text):
        return RouteDecision(
            intent="chitchat",
            confidence=0.95,
            method="regex_fastpath",
            reasoning="Greeting/chitchat pattern matched",
        )
    
    # Khata entry — has Nepali transaction words + amount
    if _KHATA_PATTERNS.search(text) and _HAS_AMOUNT.search(text):
        return RouteDecision(
            intent="khata_entry",
            confidence=0.90,
            method="regex_fastpath",
            reasoning="Transaction pattern + amount detected",
        )
    
    # Code questions — technical keywords are distinctive
    if _CODE_PATTERNS.search(text) and len(text) > 15:
        return RouteDecision(
            intent="code_qa",
            confidence=0.85,
            method="regex_fastpath",
            reasoning="Developer/code keywords detected",
        )
    
    # Nepal accounting — tax/accounting keywords
    if _ACCOUNTING_PATTERNS.search(text) and not _ERP_NAV_PATTERNS.search(text):
        return RouteDecision(
            intent="accounting_qa",
            confidence=0.80,
            method="regex_fastpath",
            reasoning="Nepal accounting/tax keywords detected",
        )
    
    # ERP navigation — where/how to access
    if _ERP_NAV_PATTERNS.search(text):
        return RouteDecision(
            intent="erp_howto",
            confidence=0.80,
            method="regex_fastpath",
            reasoning="ERP navigation keywords detected",
        )
    
    # No high-confidence match — need LLM
    return None


# ══════════════════════════════════════════════════════════════════════════════
# LLM CLASSIFICATION (qwen3:4b)
# ══════════════════════════════════════════════════════════════════════════════

_ROUTER_SYSTEM_PROMPT = """You are an intent classifier for a Nepal accounting ERP assistant.
Classify the user message into EXACTLY ONE of these categories:

- chitchat: Casual conversation, greetings, thanks, farewells, small talk
- general_qa: General knowledge questions (not about accounting, tax, or this ERP)
- accounting_qa: Questions about Nepal tax rules, accounting standards, VAT, TDS, entries
- erp_howto: Questions about how to use the ERP, where to find screens, navigation
- khata_entry: User describing a transaction to record (e.g., "Ram lai 5000 diye" = gave Ram 5000)
- code_qa: Developer questions about source code, implementation, files

Respond with ONLY a JSON object, no other text:
{"intent": "<category>", "confidence": <0.0-1.0>, "reason": "<brief explanation>"}

Examples:
User: "namaste, kasto cha?"
{"intent": "chitchat", "confidence": 0.95, "reason": "Nepali greeting"}

User: "VAT rate Nepal ma kati ho?"
{"intent": "accounting_qa", "confidence": 0.92, "reason": "Nepal tax rate question"}

User: "journal entry kahile garnu parchha?"
{"intent": "erp_howto", "confidence": 0.88, "reason": "ERP how-to question"}

User: "Ram lai 5000 udhaar diye"
{"intent": "khata_entry", "confidence": 0.94, "reason": "Transaction to record - credit sale"}

User: "Which component handles invoice form?"
{"intent": "code_qa", "confidence": 0.90, "reason": "Developer question about source code"}

User: "What is photosynthesis?"
{"intent": "general_qa", "confidence": 0.95, "reason": "General science question, not ERP/accounting"}"""


_router_llm: ChatOllama | None = None


def _get_router_llm() -> ChatOllama:
    """Get or create the fast router LLM (qwen3:4b)."""
    global _router_llm
    if _router_llm is None:
        _router_llm = ChatOllama(
            model=FAST_MODEL,
            base_url=OLLAMA_BASE_URL,
            temperature=FAST_MODEL_OPTIONS.get("temperature", 0.1),
            num_ctx=int(FAST_MODEL_OPTIONS.get("num_ctx", 2048)),
            format="json",  # Force JSON output
        )
    return _router_llm


def _parse_llm_response(text: str) -> dict:
    """Extract JSON from LLM response, handling edge cases."""
    text = text.strip()
    
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Try to find JSON in response
    json_match = re.search(r"\{[^{}]*\}", text)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass
    
    # Fallback: try to extract intent from text
    for intent in Intent:
        if intent.value in text.lower():
            return {"intent": intent.value, "confidence": 0.6, "reason": "Extracted from text"}
    
    # Default fallback
    return {"intent": "general_qa", "confidence": 0.5, "reason": "Could not parse response"}


async def _llm_classify(text: str) -> RouteDecision:
    """Classify using the fast LLM (qwen3:4b)."""
    llm = _get_router_llm()
    
    messages = [
        SystemMessage(content=_ROUTER_SYSTEM_PROMPT),
        HumanMessage(content=text),
    ]
    
    try:
        result = await asyncio.to_thread(llm.invoke, messages)
        response_text = result.content if hasattr(result, "content") else str(result)
        
        parsed = _parse_llm_response(response_text)
        
        intent = parsed.get("intent", "general_qa")
        # Validate intent
        if intent not in [i.value for i in Intent]:
            intent = "general_qa"
        
        return RouteDecision(
            intent=intent,
            confidence=float(parsed.get("confidence", 0.7)),
            method="llm",
            reasoning=parsed.get("reason", "LLM classification"),
        )
    except Exception as e:
        logger.exception("LLM classification failed")
        # Fallback to general_qa on error
        return RouteDecision(
            intent="general_qa",
            confidence=0.5,
            method="llm",
            reasoning=f"LLM error, defaulting: {e}",
        )


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ══════════════════════════════════════════════════════════════════════════════

async def classify_intent(text: str, use_llm_always: bool = False) -> RouteDecision:
    """Classify a message's intent for routing.
    
    Args:
        text: User message to classify
        use_llm_always: If True, skip regex fast-path (for testing)
    
    Returns:
        RouteDecision with intent, confidence, and routing info
    """
    text = text.strip()
    if not text:
        return RouteDecision(
            intent="chitchat",
            confidence=1.0,
            method="empty",
            reasoning="Empty message",
        )
    
    # Try regex fast-path first (unless disabled)
    if not use_llm_always:
        fast_result = _regex_fastpath(text)
        if fast_result and fast_result.confidence >= 0.85:
            logger.debug(f"Regex fast-path: {fast_result.intent} ({fast_result.confidence:.2f})")
            return fast_result
    
    # Use LLM for final classification
    result = await _llm_classify(text)
    logger.debug(f"LLM classification: {result.intent} ({result.confidence:.2f})")
    return result


def classify_intent_sync(text: str, use_llm_always: bool = False) -> RouteDecision:
    """Synchronous wrapper for classify_intent."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Create new loop for sync call from async context
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, classify_intent(text, use_llm_always))
                return future.result(timeout=10)
        return loop.run_until_complete(classify_intent(text, use_llm_always))
    except RuntimeError:
        return asyncio.run(classify_intent(text, use_llm_always))


# ══════════════════════════════════════════════════════════════════════════════
# ROUTING HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def get_rag_query(text: str, intent: IntentType) -> str | None:
    """Generate RAG query for intents that need retrieval.
    
    Returns None if intent doesn't need RAG.
    """
    if intent == "accounting_qa":
        # For accounting questions, use the original text
        return text
    elif intent == "erp_howto":
        # For ERP how-to, extract the topic/screen name
        # Remove question words to get cleaner search
        clean = re.sub(
            r"^(where|how|what|when|can|could|which|do|does|is|are)\s+(is|do|to|i|the)?\s*",
            "",
            text,
            flags=re.IGNORECASE,
        )
        return clean.strip() or text
    elif intent == "code_qa":
        # For code questions, extract technical terms
        return text
    return None


def should_skip_tools(intent: IntentType) -> bool:
    """Whether to skip tool calling for this intent.
    
    Chitchat and simple general_qa don't need tools.
    """
    return intent in ("chitchat",)


# ══════════════════════════════════════════════════════════════════════════════
# LEGACY COMPATIBILITY — map new intents to old taxonomy
# ══════════════════════════════════════════════════════════════════════════════

_LEGACY_INTENT_MAP = {
    "chitchat": "general",
    "general_qa": "general",
    "accounting_qa": "effect",
    "erp_howto": "nav",
    "khata_entry": "action_path",
    "code_qa": "code",
}


def to_legacy_intent(intent: IntentType) -> str:
    """Convert new intent to legacy intent taxonomy for backward compatibility."""
    return _LEGACY_INTENT_MAP.get(intent, "general")
