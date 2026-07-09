"""Phase 7 — Confidence cascade: local → 4b → 32b model selection."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from .intent_router import RouteDecision, classify_intent

ModelTier = Literal["none", "4b", "32b"]

_TAX_LEGAL = re.compile(
    r"\b(vat|tds|ssf|cit|income\s*tax|ird|withholding|depreciation|nfrs|ifrs|"
    r"भ्याट|आयकर|कर)\b",
    re.I,
)
_HAS_AMOUNT = re.compile(r"\b\d{2,}(?:,\d{3})*(?:\.\d{2})?\b")


@dataclass
class CascadeDecision:
    intent: str
    model: ModelTier
    confidence: float
    needs_rag: bool
    needs_tools: list[str]
    escalate_reason: str | None
    route: RouteDecision

    @property
    def use_fast(self) -> bool:
        return self.model == "4b"

    @property
    def use_tools_only(self) -> bool:
        return self.model == "none"


async def classify_cascade(text: str, *, rag_hit: bool = False) -> CascadeDecision:
    """Classify intent and pick model tier based on confidence rules."""
    route = await classify_intent(text)
    intent = route.intent
    conf = route.confidence
    tools: list[str] = []
    model: ModelTier = "32b"
    escalate: str | None = None
    needs_rag = route.needs_rag

    if intent == "chitchat":
        model = "4b"
    elif intent == "ledger_query":
        model = "none"
        tools = ["session_snapshot", "search_past_entries", "get_party_balance"]
    elif intent == "khata_entry":
        model = "32b"
        tools = ["khata_engine"]
    elif intent == "accounting_qa":
        if _TAX_LEGAL.search(text):
            model = "32b"
            escalate = "tax_legal_requires_32b"
        elif conf >= 0.90 and rag_hit:
            model = "4b"
        else:
            model = "32b"
            if conf < 0.90:
                escalate = "low_router_confidence"
            elif not rag_hit:
                escalate = "no_rag_context"
        tools = ["search_nepal_knowledge"]
    elif intent == "general_qa":
        model = "4b" if conf >= 0.92 else "32b"
        if model == "32b":
            escalate = "general_qa_low_confidence"
    elif intent == "erp_howto":
        model = "4b"
        tools = ["find_navigation_path"]
        needs_rag = True
    elif intent == "code_qa":
        model = "32b"
        tools = ["search_codebase"]
        needs_rag = True

    # Amount-bearing accounting questions → always 32b
    if intent == "accounting_qa" and _HAS_AMOUNT.search(text):
        model = "32b"
        escalate = "amount_in_accounting_question"

    return CascadeDecision(
        intent=intent,
        model=model,
        confidence=conf,
        needs_rag=needs_rag,
        needs_tools=tools,
        escalate_reason=escalate,
        route=route,
    )
