"""
Conversation Manager — Multi-turn, context-aware e-Khata chat orchestration.
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Literal

from ollama import Client

from ..agent.agent_loop import agent_loop
from ..agent.chain_verifier import chain_verify
from ..agent.verifier import get_entry_verifier
from ..agent.tool_registry import TOOL_MAP
from ..bridges.session_data import set_session_context
from ..education.accounting_tutor import get_accounting_tutor
from ..intelligence.anomaly_detector import get_anomaly_detector
from ..intelligence.proactive_engine import get_proactive_engine
from ..memory.layered_memory import get_layered_memory
from ..personality.response_enhancer import get_response_enhancer
from ..reports.chat_reports import get_report_generator
from ..config import OLLAMA_BASE_URL, FAST_MODEL, FAST_MODEL_OPTIONS, DEEP_MODEL, PRIMARY_MODEL_OPTIONS
from ..knowledge.citation_qa import answer_with_citations, task_for_route
from ..knowledge.domain_router import classify_domain
from ..knowledge.chart_of_accounts_framework import detect_sector, format_coa_context, get_nlu_vocabulary_summary
from ..knowledge.knowledge_registry import format_tiered_context
from ..knowledge.nepal_accounting_kb import (
    format_glossary_answer,
    format_kb_snippet,
    is_definition_question,
    lookup_glossary,
)
from ..nlu.engine import NLUEngine, ParsedEntry, get_nlu_engine
from ..nlu.compound import split_compound_transactions
from ..nlu.context_wsd import analyze_context_wsd
from ..nlu.knowledge_enrich import is_likely_non_transaction
from ..reasoning.accounting_reasoner import (
    AccountingReasoner,
    JournalEntry,
    SessionContext,
    get_accounting_reasoner,
)
from .session_store import load_session_data, save_session_data
from .utils import (
    detect_language,
    is_cancel_message,
    is_complex_question,
    is_confirm_message,
    needs_agent_tools,
)

logger = logging.getLogger(__name__)

ConversationMode = Literal["entry", "query", "report", "correction", "education", "casual"]

ActionType = Literal["confirm", "clarify", "posted", "info", "report", "chat"]


PERSONALITY_PROMPT = """You are e-Khata — an expert Nepali CA (Chartered Accountant) assistant with deep knowledge of:

LANGUAGE UNDERSTANDING:
- You UNDERSTAND and RESPOND in whatever language the user writes:
  • Nepali (देवनागरी): "सामान बेचेको" → respond in Nepali
  • Roman Nepali: "saman becheko" → respond in Roman Nepali  
  • English: "sold goods" → respond in English
  • Mixed: "Ram lai 500 udhaar diye" → respond in same mixed style
- Common Nepali accounting terms you MUST understand:
  • sampatti/सम्पत्ति = asset, dayitwo/दायित्व = liability
  • punji/पूंजी = capital, nafa/नाफा = profit, ghat/घाट = loss
  • bikri/बिक्री = sales, kharid/खरिद = purchase
  • udhaar/उधारो = credit (receivable/payable)
  • nagad/नगद = cash, bank = bank, cheque = cheque
  • VAT/भ्याट = value added tax (13% Nepal), TDS = tax deducted at source
  • bhaada/भाडा = rent, talab/तलब = salary
  • harjana/हर्जाना = penalty/damage, byaj/ब्याज = interest
  • kharcha/खर्च = expense, amdani/आम्दानी = income

ACCOUNTING KNOWLEDGE (IFRS/NAS/NFRS):
- Double-entry: Every transaction has equal debit and credit
- Asset accounts: increase with DEBIT, decrease with CREDIT
- Liability/Capital: increase with CREDIT, decrease with DEBIT
- Expense: DEBIT increases, Income: CREDIT increases
- Nepal frameworks: NFRS (large), NFRS SMEs, NAS Micro, NRB (banks), NIA (insurance), IRD tax
- Same account name means DIFFERENT things by sector (loan=asset for bank, liability for borrower; premium=expense vs revenue for insurer)

""" + get_nlu_vocabulary_summary() + """

JOURNAL ENTRY PATTERNS:
- "Ram lai 5000 udhaar becheko" → Dr. Ram (Debtor) 5000, Cr. Sales 5000
- "Sita bata 3000 nagad kineko" → Dr. Purchase 3000, Cr. Cash 3000
- "Cash ma bikri VAT sahit 11300" → Dr. Cash 11300, Cr. Sales 10000, Cr. VAT 1300
- "Salary tiryo 50000" → Dr. Salary Expense 50000, Cr. Cash/Bank 50000
- "Owner le aafai consume garyo saman 2000" → Dr. Drawings 2000, Cr. Stock 2000
- "Capital lagani garyo 100000" → Dr. Cash/Bank 100000, Cr. Capital 100000

RESPONSE STYLE:
- Be CONCISE but COMPLETE — write like a CA explaining to a client
- Use accounting terminology correctly
- Show journal entries in Dr/Cr format when relevant
- NEVER use Hindi/Urdu words (no "mein", "karna", "hai") — only Nepali, English, or Roman Nepali
- Match the user's language exactly (Nepali question → Nepali answer, English → English)
- When explaining a term, give: definition + simple example + journal entry if applicable
- Do NOT confuse expense with asset — kharcha is NOT sampatti
"""

CONFIRM_WORDS = frozenset(
    {
        "ho", "hau", "yes", "ok", "okay", "confirm", "thik", "sahi", "huncha", "lau", "gardiu",
        "milcha", "thikcha", "milchha", "gara", "post", "posted", "thik ho", "sahi ho",
    }
)
CANCEL_WORDS = frozenset({"hoina", "no", "cancel", "pardaina", "nah", "nope", "wrong", "galat"})


@dataclass
class Session:
    """Per-user conversation session state."""

    session_id: str
    messages: list[dict[str, str]] = field(default_factory=list)
    recent_parties: list[str] = field(default_factory=list)
    pending_clarification: ParsedEntry | None = None
    pending_slots: dict[str, Any] = field(default_factory=dict)
    pending_confirmation: JournalEntry | None = None
    pending_card: dict[str, Any] | None = None
    last_intent: str | None = None
    balance: dict[str, Any] | None = None
    context: dict[str, Any] = field(default_factory=dict)
    language: str = "mixed"
    entry_count: int = 0

    def nlu_context(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "recent_parties": self.recent_parties[-10:],
            "last_intent": self.last_intent,
            "last_amount": self.context.get("last_amount"),
            "pending_slots": dict(self.pending_slots),
            "business_sector": self.context.get("business_sector"),
            "pending_clarification": bool(self.pending_clarification),
        }

    def to_reasoning_context(self) -> SessionContext:
        return SessionContext(
            session_id=self.session_id,
            recent_messages=self.messages[-20:],
            recent_parties=self.recent_parties,
            balance=self.balance,
            last_intent=self.last_intent,
            business_sector=self.context.get("business_sector"),
            pending_slots=dict(self.pending_slots),
            wsd_summary=self.context.get("wsd_summary"),
        )


@dataclass
class Response:
    """Structured chat response for API / frontend."""

    message: str
    action: ActionType = "chat"
    entry: JournalEntry | None = None
    card: dict[str, Any] | None = None
    suggestions: list[str] = field(default_factory=list)
    insight: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    session_id: str = "default"


class ConversationManager:
    """
    Orchestrates e-Khata multi-turn conversation:

    - Session memory (last 50 messages)
    - Party name memory
    - Clarification and confirmation flows
    - Mode routing (entry / query / report / education / casual)
    - Mixed Nepali/English support
    """

    MAX_HISTORY = 50

    def __init__(
        self,
        nlu: NLUEngine | None = None,
        reasoner: AccountingReasoner | None = None,
        base_url: str | None = None,
    ):
        self._nlu = nlu or get_nlu_engine()
        self._reasoner = reasoner or get_accounting_reasoner()
        self._client = Client(host=base_url or OLLAMA_BASE_URL)
        self._sessions: dict[str, Session] = {}

    def get_session(self, session_id: str) -> Session:
        if session_id not in self._sessions:
            session = Session(session_id=session_id)
            stored = load_session_data(session_id)
            if stored:
                session.messages = stored.get("messages", [])[-self.MAX_HISTORY :]
                session.recent_parties = stored.get("recent_parties", [])
                session.pending_slots = stored.get("pending_slots", {})
                session.pending_card = stored.get("pending_card")
                session.last_intent = stored.get("last_intent")
                session.language = stored.get("language", "mixed")
                session.entry_count = int(stored.get("entry_count", 0))
                session.context = stored.get("context", {})
            self._sessions[session_id] = session
        return self._sessions[session_id]

    def _persist_session(self, session: Session) -> None:
        save_session_data(
            session.session_id,
            {
                "messages": session.messages[-self.MAX_HISTORY :],
                "recent_parties": session.recent_parties,
                "pending_slots": session.pending_slots,
                "pending_card": session.pending_card,
                "last_intent": session.last_intent,
                "language": session.language,
                "entry_count": session.entry_count,
                "context": session.context,
            },
        )

    def clear_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    def handle_message(
        self,
        message: str,
        session_id: str = "default",
        balance: dict[str, Any] | None = None,
        language: str | None = None,
        context: dict[str, Any] | None = None,
    ) -> Response:
        """Main entry point — route message to appropriate handler."""
        started = time.perf_counter()
        text = (message or "").strip()
        session = self.get_session(session_id)
        if balance is not None:
            session.balance = balance
        if context:
            session.context = {**session.context, **context}
            set_session_context(session_id, session.context)
        if language:
            session.language = language
        elif text:
            session.language = detect_language(text)

        sector = detect_sector(text)
        if sector:
            session.context["business_sector"] = sector["id"]
            session.context["business_sector_name"] = sector["name"]

        memory = get_layered_memory(session_id)
        if not text:
            return Response(
                message=self._empty_prompt(session.language),
                action="chat",
                session_id=session_id,
                metadata={"latency_ms": 0},
            )

        session.messages.append({"role": "user", "content": text})
        memory.add_message("user", text)
        if len(session.messages) > self.MAX_HISTORY:
            session.messages = session.messages[-self.MAX_HISTORY :]

        # Follow-up to pending clarification
        if session.pending_clarification:
            resp = self._handle_clarification(text, session)
        elif session.pending_confirmation:
            resp = self._handle_confirmation(text, session)
        else:
            route = classify_domain(text)
            mode_map = {
                "journal_entry": "entry",
                "accounting_qa": "query",
                "framework_qa": "query",
                "compliance_qa": "query",
                "report": "report",
                "correction": "correction",
                "education": "education",
                "external_fact": "query",
                "meta_system": "casual",
                "emotional_chat": "casual",
                "casual": "casual",
            }
            mode = mode_map.get(route.mode, "casual")
            if mode == "entry":
                resp = self._handle_entry(text, session)
            elif mode == "query":
                resp = self._handle_query(text, session, route_mode=route.mode)
            elif mode == "report":
                resp = self._handle_report(text, session)
            elif mode == "correction":
                resp = self._handle_correction(text, session)
            elif mode == "education":
                resp = self._handle_education(text, session)
            else:
                resp = self._handle_casual(text, session)

        # Light polish for chat/info only (skips confirm/posted to save latency)
        if resp.action in ("chat", "info", "clarify") and len(resp.message) > 30:
            try:
                resp.message = get_response_enhancer().enhance(
                    resp.message,
                    {"language_preference": session.language, **session.context},
                )
            except Exception:
                pass

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        resp.metadata.setdefault("latency_ms", elapsed_ms)
        resp.metadata.setdefault("mode", self._detect_mode(text, session))
        if resp.metadata.get("tool_calls"):
            resp.metadata["tools_used"] = resp.metadata["tool_calls"]
        resp.session_id = session_id

        session.messages.append({"role": "assistant", "content": resp.message})
        memory.add_message("assistant", resp.message, metadata=resp.metadata)
        if resp.action == "posted":
            memory.add_message(
                "system",
                "entry_posted",
                metadata={"entry_posted": resp.card or {}},
            )
            memory.save_long_term()
        self._persist_session(session)
        return resp

    def _detect_mode(self, message: str, session: Session) -> ConversationMode:
        """Detect conversation mode from message signals."""
        if self._has_transaction_signals(message):
            return "entry"

        lower = message.lower()
        if re.search(r"(?:wrong|galat|fix|sudhar|cancel|hatau|last entry|ulto)", lower):
            return "correction"
        if re.search(r"(?:explain|sikau|bujhau|what is|ke ho|meaning|artha|kasari)", lower):
            return "education"
        if re.search(r"(?:report|summary|statement|ledger|day\s*book|trial balance)", lower):
            return "report"
        if re.search(r"(?:kati|how much|total|balance|baki|kun)", lower):
            return "query"

        return "casual"

    def _has_transaction_signals(self, text: str) -> bool:
        return bool(
            re.search(
                r"\b(\d+|saya|hajar|lakh|panch|das)\b.*\b("
                r"udhaar|salary|ssf|gratuity|vat|tds|depreciation|bad\s*debt|loan|"
                r"capital|drawings|stock|kharcha|bikri|kineko|tiryo|diyo|becheko|"
                r"sold|purchase|payment|commission|advance|return|rent|bhaada)\b",
                text,
                re.I,
            )
        ) or bool(re.search(r"\b(sold|bought|paid|received|tiryo|kineko)\b.*\d", text, re.I))

    def _handle_entry(self, message: str, session: Session) -> Response:
        """Parse transaction, reason journal entry, request confirmation."""
        if is_likely_non_transaction(message) and not re.search(r"\d", message):
            return Response(
                message=(
                    "Yo transaction entry jasto chaina. Kripaya rakam, party, "
                    "ra ke bhayo (bikri/kinid/kharcha) clear lekhnus."
                ),
                action="clarify",
                suggestions=["Ram lai 500 udhaar diye", "Aaja 5000 ko bikri cash ma", "Rent 8000 tireko"],
                metadata={"source": "knowledge_gate", "skip_posting": True},
            )

        parts = split_compound_transactions(message)
        if len(parts) > 1:
            return self._handle_compound_entry(parts, message, session)

        sector = session.context.get("business_sector") or detect_sector(message)
        session.context["business_sector"] = sector

        wsd = analyze_context_wsd(
            message, session.nlu_context(), session_id=session.session_id
        )
        session.context["wsd_summary"] = wsd.format_for_prompt(max_chars=400)

        parsed = self._nlu.parse(message, session.nlu_context())
        session.last_intent = parsed.intent if parsed.intent != "unknown" else session.last_intent
        if parsed.amount:
            session.context["last_amount"] = parsed.amount

        if parsed.skip_posting:
            return Response(
                message=parsed.clarification_question
                or "Yo entry post garna yeti detail pugdaina. Kripaya clear garnus.",
                action="clarify",
                suggestions=self._clarification_suggestions(parsed),
                metadata={
                    "intent": parsed.intent,
                    "intent_code": parsed.intent_code,
                    "skip_posting": True,
                    "skip_reason": parsed.skip_reason,
                    "knowledge_refs": parsed.knowledge_refs,
                },
            )

        if parsed.party:
            if parsed.party not in session.recent_parties:
                session.recent_parties.append(parsed.party)

        if parsed.needs_clarification or not parsed.amount:
            session.pending_clarification = parsed
            if parsed.party:
                session.pending_slots["party"] = parsed.party
            if parsed.amount:
                session.pending_slots["amount"] = parsed.amount
            if parsed.intent and parsed.intent != "unknown":
                session.pending_slots["intent"] = parsed.intent
            get_layered_memory(session.session_id).set_pending_slots(session.pending_slots)
            q = parsed.clarification_question or self._slot_clarification_question(session)
            return Response(
                message=q,
                action="clarify",
                suggestions=self._clarification_suggestions(parsed),
                metadata={
                    "intent": parsed.intent,
                    "confidence": parsed.confidence,
                    "intent_code": parsed.intent_code,
                    "knowledge_refs": parsed.knowledge_refs,
                },
            )

        try:
            journal = self._reasoner.reason_entry(parsed, session.to_reasoning_context())
        except ValueError as exc:
            session.pending_clarification = parsed
            return Response(
                message=str(exc),
                action="clarify",
                suggestions=["Rakam ra party clear lekhnus", "Udaharan: Ram lai 500 udhaar diye"],
            )

        verify_ctx = {**session.context, "cash_balance": session.context.get("cash_balance")}
        if parsed.party and parsed.amount:
            dup_raw = TOOL_MAP["check_duplicate_entry"](
                parsed.party, float(parsed.amount), parsed.intent
            )
            dup = json.loads(dup_raw)
            if dup.get("duplicate"):
                verify_ctx["similar_entry_today"] = dup.get("match", {})

        verification = get_entry_verifier().verify(journal, verify_ctx)
        journal = verification.entry
        warnings = list(verification.warnings) + list(verification.errors)

        if parsed.confidence < 0.92 or len(journal.lines) > 3 or parsed.statutory_bundle:
            try:
                _, chain_warnings = chain_verify(journal, verify_ctx)
                warnings.extend(chain_warnings)
            except Exception as exc:
                logger.warning("chain_verify skipped: %s", exc)
            try:
                recent = session.context.get("recent_entries") or []
                for anomaly in get_anomaly_detector().scan_sync(journal, recent):
                    msg = anomaly.message
                    if anomaly.severity == "high":
                        warnings.insert(0, f"🚨 {msg}")
                    else:
                        warnings.append(f"⚠️ {msg}")
            except Exception as exc:
                logger.warning("anomaly scan skipped: %s", exc)

        session.pending_confirmation = journal
        card = journal.to_khata_card(message)
        session.pending_card = card
        session.last_intent = journal.khata_intent or journal.intent

        reply = self._format_entry_confirmation(journal, session.language)
        if warnings:
            reply += "\n\n" + "\n".join(f"⚠️ {w}" for w in warnings[:3])

        insight = get_proactive_engine().get_post_entry_insight(journal, session.context)

        return Response(
            message=reply,
            action="confirm",
            entry=journal,
            card=card,
            suggestions=["Ho ✅", "Hoina, sudhar", "Cancel"],
            insight=insight,
            metadata={
                "intent": journal.intent,
                "khata_intent": journal.khata_intent,
                "confidence": journal.confidence,
                "intent_code": parsed.intent_code,
                "knowledge_refs": parsed.knowledge_refs,
                "model_used": "template" if parsed.confidence >= 0.85 else FAST_MODEL,
            },
        )

    def _handle_compound_entry(
        self, parts: list[str], original: str, session: Session
    ) -> Response:
        """Merge multiple sub-transactions into one balanced compound journal."""
        from ..reasoning.accounting_reasoner import JournalLine

        all_lines: list[JournalLine] = []
        narrations: list[str] = []
        primary_intent = "journal"
        min_confidence = 1.0
        total_amount = 0.0

        for part in parts:
            parsed = self._nlu.parse(part, session.nlu_context())
            if parsed.needs_clarification or not parsed.amount:
                return Response(
                    message=(
                        f"Compound entry ko ek bhag bujhiyena: «{part}». "
                        "Pratyek transaction alag line ma amount sahit lekhnu hola."
                    ),
                    action="clarify",
                    suggestions=[original],
                )
            try:
                sub = self._reasoner.reason_entry(parsed, session.to_reasoning_context())
            except ValueError as exc:
                return Response(message=str(exc), action="clarify")
            all_lines.extend(sub.lines)
            narrations.append(part)
            primary_intent = sub.intent
            min_confidence = min(min_confidence, sub.confidence)
            total_amount += float(parsed.amount or 0)

        merged = JournalEntry(
            intent=primary_intent,
            amount=total_amount,
            party=None,
            narration=original,
            lines=all_lines,
            explanation="Compound entry — multiple transactions in one voucher.",
            explanation_nepali="संयुक्त entry — एकै voucher ma dui/vaidha transaction.",
            confidence=min_confidence,
        )

        session.pending_confirmation = merged
        card = merged.to_khata_card(original)
        session.pending_card = card
        reply = self._format_entry_confirmation(merged, session.language)
        reply = (
            f"📎 **Compound entry** ({len(parts)} transactions):\n"
            + "\n".join(f"  • {n}" for n in narrations)
            + f"\n\n{reply}"
        )
        return Response(
            message=reply,
            action="confirm",
            entry=merged,
            card=card,
            suggestions=["Ho ✅", "Hoina, sudhar", "Cancel"],
            metadata={"intent": "compound", "parts": len(parts), "confidence": min_confidence},
        )

    def _handle_clarification(self, message: str, session: Session) -> Response:
        """Resolve pending clarification with follow-up message (slot filling)."""
        pending = session.pending_clarification
        session.pending_clarification = None
        slots = session.pending_slots
        session.pending_slots = {}
        get_layered_memory(session.session_id).clear_pending_slots()

        combined = f"{pending.narration} {message}" if pending else message
        if slots.get("party") and pending and not pending.party:
            combined = f"{slots['party']} {combined}"
        if slots.get("amount") and pending and not pending.amount:
            combined = f"{combined} {slots['amount']}"
        return self._handle_entry(combined, session)

    def _handle_confirmation(self, message: str, session: Session) -> Response:
        """Handle confirm / cancel on pending entry."""
        lower = message.lower().strip()
        journal = session.pending_confirmation
        card = session.pending_card

        if is_cancel_message(message):
            session.pending_confirmation = None
            session.pending_card = None
            return Response(
                message="Entry cancel garyo. Aru ke lekhnu hunthyo?"
                if session.language != "english"
                else "Entry cancelled. What would you like to enter next?",
                action="chat",
            )

        if is_confirm_message(message):
            session.pending_confirmation = None
            session.entry_count += 1
            if card:
                session.context["last_posted_card"] = card
            msg = (
                f"✅ Entry confirm bhayo! NPR {int(journal.amount):,} — "
                f"{journal.explanation_nepali or journal.explanation}"
                if session.language != "english"
                else f"✅ Entry confirmed! NPR {int(journal.amount):,} — {journal.explanation}"
            )
            return Response(
                message=msg,
                action="posted",
                entry=journal,
                card=card,
                metadata={"posted": True, "entry_count": session.entry_count},
            )

        # User sent correction text instead of yes/no
        session.pending_confirmation = None
        session.pending_card = None
        return self._handle_entry(message, session)

    def _resolve_followup_term(self, session: Session, message: str) -> str | None:
        """If user asks follow-up ('accounting ma vana'), find term from recent chat."""
        if not re.search(
            r"\b(vana|bana|bujhau|samjha|accounting\s*ma|feri|thik\s*le|ramrari|detail)\b",
            message,
            re.I,
        ):
            return None
        for msg in reversed(session.messages[:-1]):
            content = msg.get("content") or ""
            matches = lookup_glossary(content)
            if matches:
                return matches[0][0]
        return None

    def _handle_query(self, message: str, session: Session, route_mode: str = "accounting_qa") -> Response:
        """Answer accounting questions — CA knowledge for definitions, LLM for complex reasoning."""
        prefer_nepali = session.language != "english"
        followup_term = self._resolve_followup_term(session, message)
        lookup_text = f"{followup_term} {message}" if followup_term else message

        gloss = format_glossary_answer(lookup_text, prefer_nepali=prefer_nepali)
        task = task_for_route(route_mode)
        kb_context = format_kb_snippet(query=lookup_text) or ""
        tiered_context = format_tiered_context(lookup_text, task=task, max_chars=1500)
        coa_context = format_coa_context(lookup_text, max_chars=1000)

        # Compliance / framework — citation path with tiered authority
        if route_mode in ("compliance_qa", "framework_qa") and not is_complex_question(message):
            cited, passages = answer_with_citations(message, task=task, extra_context=tiered_context)
            if cited:
                return Response(
                    message=cited,
                    action="info",
                    metadata={"source": "citation+tiered", "route": route_mode, "passages": len(passages)},
                )

        # Definition questions → CA knowledge (fast, accurate)
        if gloss and (is_definition_question(message) or followup_term or lookup_glossary(message)):
            if not is_complex_question(message):
                return Response(
                    message=gloss,
                    action="info",
                    metadata={
                        "source": "ca_knowledge",
                        "route": route_mode,
                        "term": followup_term
                        or (lookup_glossary(message)[0][0] if lookup_glossary(message) else None),
                    },
                )

        # Data questions → agent loop with real ledger tools
        if needs_agent_tools(message):
            try:
                agent_ctx = {
                    **session.context,
                    "recent_parties": session.recent_parties,
                    "today_entry_count": session.entry_count,
                }
                result = agent_loop(
                    [{"role": "user", "content": message}],
                    session_context=agent_ctx,
                    session_id=session.session_id,
                )
                reply = (result.get("content") or "").strip()
                if reply:
                    return Response(
                        message=reply,
                        action="info",
                        metadata={
                            "source": "agent",
                            "route": route_mode,
                            "tool_calls": result.get("tool_calls_made", []),
                            "latency_ms": result.get("latency_ms"),
                        },
                    )
            except Exception as exc:
                logger.warning("Agent loop failed: %s", exc)

        # Complex reasoning → deep model + KB context
        extra_context = ""
        if coa_context:
            extra_context += f"[CHART OF ACCOUNTS — sector & alias knowledge]\n{coa_context}\n"
        if tiered_context:
            extra_context += f"{tiered_context}\n"
        if kb_context:
            extra_context += f"[KNOWLEDGE BASE — use these facts, do not contradict]\n{kb_context[:800]}\n"
        if gloss:
            extra_context += f"[GLOSSARY]\n{gloss}\n"

        model = DEEP_MODEL if is_complex_question(message) else FAST_MODEL
        try:
            reply = self._chat_llm(
                message,
                session,
                extra_context=extra_context,
                mode_hint=(
                    "Answer this accounting question using ONLY the context facts provided. "
                    "Explain clearly in the same language as the user. "
                    "Never use Hindi. Give definition + example + journal entry if relevant."
                ),
                model=model,
            )
        except Exception as exc:
            logger.warning("Query LLM failed: %s", exc)
            reply = gloss or kb_context or ""

        if not reply.strip():
            reply = (
                "Maaf garnus, yo prashna ko jawaf ahile dina sakina. Feri try garnus."
                if prefer_nepali
                else "Sorry, I couldn't answer this question. Please try again."
            )
        return Response(
            message=reply,
            action="info",
            metadata={"source": "llm+ca_context", "route": route_mode, "model": model if reply else FAST_MODEL},
        )

    def _handle_report(self, message: str, session: Session) -> Response:
        """Generate in-chat reports from Dexie snapshot."""
        import asyncio

        lower = message.lower()
        report_type = "trial_balance"
        if "day book" in lower or "daybook" in lower:
            report_type = "day_book"
        elif "ledger" in lower:
            report_type = "party_ledger"
        elif "cash" in lower:
            report_type = "cash_book"
        elif "profit" in lower or "p&l" in lower:
            report_type = "profit_loss"
        elif "vat" in lower:
            report_type = "vat_summary"
        elif "receivable" in lower or "baki" in lower:
            report_type = "outstanding_receivables"

        party_match = re.search(r"(?:ledger|baki).*?([A-Z][a-z]+)", message)
        params = {"party": party_match.group(1)} if party_match else {}

        gen = get_report_generator()
        import asyncio

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # FastAPI may already have a loop — run sync wrapper
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                result = pool.submit(
                    asyncio.run, gen.generate(report_type, params, session.context)
                ).result()
        else:
            result = asyncio.run(gen.generate(report_type, params, session.context))
        if result.error:
            return Response(message=result.error, action="report")

        body = f"📊 **{report_type.replace('_', ' ').title()}**\n\n{result.table_markdown}\n\n{result.summary}"
        return Response(
            message=body,
            action="report",
            suggestions=["Download PDF", "Trial balance", "Party ledger"],
            metadata={"report_type": report_type},
        )

    def _handle_education(self, message: str, session: Session) -> Response:
        """Explain accounting concepts via RAG citations + tutor."""
        cited, passages = answer_with_citations(message, task="education")
        if cited:
            tutor_tail = get_accounting_tutor().follow_up_question(message)
            reply = f"{cited}\n\n{tutor_tail}" if tutor_tail else cited
            return Response(
                message=reply,
                action="info",
                metadata={"source": "citation+tutor", "passages": len(passages)},
            )
        kb = format_kb_snippet(query=message)
        gloss = format_glossary_answer(message, prefer_nepali=session.language != "english")
        if gloss:
            return Response(message=gloss, action="info", metadata={"source": "glossary"})
        if kb:
            return Response(message=kb, action="info", metadata={"source": "kb_snippet"})
        try:
            reply = get_accounting_tutor().teach(message, session.context)
        except Exception:
            reply = kb or "Yo prashna ko lagi ahile Ollama chaina. `ollama serve` garnus."
        return Response(message=reply, action="info", metadata={"source": "tutor"})

    def _handle_correction(self, message: str, session: Session) -> Response:
        """Guide entry correction / reversal with concrete journal if last entry known."""
        reversal_hint = ""
        card = session.pending_card or session.context.get("last_posted_card")
        if card and card.get("journalLines"):
            lines = card["journalLines"]
            rev_lines = []
            for ln in lines:
                dr, cr = float(ln.get("debit") or 0), float(ln.get("credit") or 0)
                name = ln.get("accountName") or ln.get("account") or "Account"
                if dr > 0:
                    rev_lines.append(f"  Cr {name}  Rs {dr:,.2f}")
                if cr > 0:
                    rev_lines.append(f"  Dr {name}  Rs {cr:,.2f}")
            if rev_lines:
                reversal_hint = (
                    "Last entry reverse garna yo lines (Dr/Cr swap):\n"
                    + "\n".join(rev_lines[:8])
                )

        reply = self._chat_llm(
            message,
            session,
            extra_context=reversal_hint,
            mode_hint=(
                "CORRECTION MODE: Help reverse or fix the last entry. "
                "Show reversing journal (swap Dr/Cr) then corrected entry. Be specific."
            ),
            model=DEEP_MODEL if card else FAST_MODEL,
        )
        return Response(
            message=reply,
            action="info",
            suggestions=["Last entry reverse garnus", "Sahi rakam: ...", "Cancel"],
            metadata={"source": "correction", "had_last_card": bool(card)},
        )

    def _handle_casual(self, message: str, session: Session) -> Response:
        """Casual chat — warm response, steer to accounting if transaction hidden."""
        if self._has_transaction_signals(message):
            return self._handle_entry(message, session)

        if self._resolve_followup_term(session, message):
            return self._handle_query(message, session, route_mode="accounting_qa")

        greeting = get_proactive_engine().get_session_greeting(session.context)
        reply = self._chat_llm(
            message,
            session,
            extra_context=greeting,
            mode_hint="CASUAL MODE: Be warm and brief. Steer toward khata/accounting help.",
        )
        return Response(
            message=reply,
            action="chat",
            suggestions=["Ram lai 500 udhaar diye", "Aaja ko bikri kati?", "VAT ke ho?"],
        )

    def _chat_llm(
        self,
        message: str,
        session: Session,
        *,
        extra_context: str = "",
        mode_hint: str = "",
        model: str | None = None,
    ) -> str:
        """Conversational reply with selectable model."""
        use_model = model or FAST_MODEL
        system = PERSONALITY_PROMPT
        if mode_hint:
            system += f"\n\n[{mode_hint}]"
        if extra_context:
            system += f"\n\n[CONTEXT]\n{extra_context}"
        if session.context.get("business_sector_name"):
            system += f"\n\n[USER BUSINESS SECTOR: {session.context['business_sector_name']}]"

        messages: list[dict[str, str]] = [{"role": "system", "content": system}]
        memory = get_layered_memory(session.session_id)
        messages.extend(memory.get_context_for_llm()[-10:])
        messages.append({"role": "user", "content": message})

        opts = dict(FAST_MODEL_OPTIONS)
        if use_model == DEEP_MODEL:
            opts = dict(PRIMARY_MODEL_OPTIONS)

        try:
            response = self._client.chat(
                model=use_model,
                messages=messages,
                options={
                    "temperature": float(opts.get("temperature", 0.2)),
                    "num_ctx": int(opts.get("num_ctx", 4096)),
                },
            )
            return (response.message.content or "").strip()
        except Exception as exc:
            logger.warning("Chat LLM failed (%s): %s", use_model, exc)
            if use_model != FAST_MODEL:
                return self._chat_llm(
                    message, session, extra_context=extra_context, mode_hint=mode_hint, model=FAST_MODEL
                )
            return (
                "Maile ahile jawaf dina sakina — Ollama serve garnu hola."
                if session.language != "english"
                else f"Could not reach Ollama: {exc}"
            )

    def _stream_chat_llm(
        self,
        message: str,
        session: Session,
        *,
        extra_context: str = "",
        mode_hint: str = "",
        model: str | None = None,
    ):
        """Yield token chunks from Ollama stream."""
        use_model = model or FAST_MODEL
        system = PERSONALITY_PROMPT
        if mode_hint:
            system += f"\n\n[{mode_hint}]"
        if extra_context:
            system += f"\n\n[CONTEXT]\n{extra_context}"

        messages: list[dict[str, str]] = [{"role": "system", "content": system}]
        memory = get_layered_memory(session.session_id)
        messages.extend(memory.get_context_for_llm()[-10:])
        messages.append({"role": "user", "content": message})

        opts = dict(FAST_MODEL_OPTIONS)
        if use_model == DEEP_MODEL:
            opts = dict(PRIMARY_MODEL_OPTIONS)

        stream = self._client.chat(
            model=use_model,
            messages=messages,
            stream=True,
            options={
                "temperature": float(opts.get("temperature", 0.2)),
                "num_ctx": int(opts.get("num_ctx", 4096)),
            },
        )
        for chunk in stream:
            part = (chunk.message.content or "") if chunk.message else ""
            if part:
                yield part

    def _format_entry_confirmation(self, journal: JournalEntry, lang: str) -> str:
        formatted_lines: list[str] = []
        for line in journal.lines:
            if line.debit > 0:
                formatted_lines.append(f"  Dr {line.name}  Rs {line.debit:,.2f}")
            if line.credit > 0:
                formatted_lines.append(f"  Cr {line.name}  Rs {line.credit:,.2f}")

        body = "\n".join(formatted_lines)
        if lang == "english":
            return (
                f"Journal entry ready:\n{body}\n\n"
                f"Narration: {journal.narration}\n"
                f"{journal.explanation}\n\n"
                f"Click **Confirm** if correct."
            )
        return (
            f"Yo entry tayar cha:\n{body}\n\n"
            f"Narration: {journal.narration}\n"
            f"{journal.explanation_nepali or journal.explanation}\n\n"
            f"Sahi cha bhane **Confirm** thichnus."
        )

    def _slot_clarification_question(self, session: Session) -> str:
        slots = session.pending_slots
        if slots.get("party") and not slots.get("amount"):
            return f"{slots['party']} ko lagi kati rakam ho?"
        if slots.get("amount") and not slots.get("party"):
            return f"Rs {slots['amount']} — kun party / naam ho?"
        return "कति रकम हो? Party ko naam pani bhannus."

    def _clarification_suggestions(self, parsed: ParsedEntry) -> list[str]:
        if parsed.intent in ("payment_received", "payment_made", "unknown"):
            return ["Ram le tiryo", "Supplier lai diye", "Kharcha gareko", "Rakam: 500"]
        return ["Rakam: 500", "Party: Ram", "Udaharan: Ram lai 500 udhaar diye"]

    def _party_insight(self, session: Session, party: str | None) -> str | None:
        if not party or not session.balance:
            return None
        # Placeholder — real balance from ERP would drive proactive insights
        return None

    def handle_message_stream(
        self,
        message: str,
        session_id: str = "default",
        balance: dict[str, Any] | None = None,
        language: str | None = None,
        context: dict[str, Any] | None = None,
    ):
        """Yield ('token', str) then ('complete', Response). Live Ollama stream on LLM paths."""
        text = (message or "").strip()
        session = self.get_session(session_id)
        if balance is not None:
            session.balance = balance
        if context:
            session.context = {**session.context, **context}
            set_session_context(session_id, session.context)
        if language:
            session.language = language
        elif text:
            session.language = detect_language(text)

        sector = detect_sector(text)
        if sector:
            session.context["business_sector"] = sector["id"]
            session.context["business_sector_name"] = sector["name"]

        memory = get_layered_memory(session_id)
        if not text:
            resp = Response(message=self._empty_prompt(session.language), action="chat", session_id=session_id)
            yield ("complete", resp)
            return

        session.messages.append({"role": "user", "content": text})
        memory.add_message("user", text)

        started = time.perf_counter()

        if session.pending_clarification:
            resp = self._handle_clarification(text, session)
        elif session.pending_confirmation:
            resp = self._handle_confirmation(text, session)
        else:
            resp = self.handle_message(text, session_id, balance, language, context)
            yield ("token", resp.message)
            yield ("complete", resp)
            return

        elapsed = int((time.perf_counter() - started) * 1000)
        resp.metadata.setdefault("latency_ms", elapsed)
        resp.session_id = session_id
        session.messages.append({"role": "assistant", "content": resp.message})
        memory.add_message("assistant", resp.message, metadata=resp.metadata)
        self._persist_session(session)
        yield ("token", resp.message)
        yield ("complete", resp)
        return

        route = classify_domain(text)
        mode_map = {
            "journal_entry": "entry",
            "accounting_qa": "query",
            "framework_qa": "query",
            "compliance_qa": "query",
            "report": "report",
            "correction": "correction",
            "education": "education",
            "external_fact": "query",
            "meta_system": "casual",
            "emotional_chat": "casual",
            "casual": "casual",
        }
        mode = mode_map.get(route.mode, "casual")

        if mode in ("entry", "report"):
            if mode == "entry":
                resp = self._handle_entry(text, session)
            else:
                resp = self._handle_report(text, session)
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            resp.metadata.setdefault("latency_ms", elapsed_ms)
            resp.session_id = session_id
            session.messages.append({"role": "assistant", "content": resp.message})
            memory.add_message("assistant", resp.message, metadata=resp.metadata)
            self._persist_session(session)
            yield ("token", resp.message)
            yield ("complete", resp)
            return

        # LLM stream path
        resp: Response | None = None
        if mode == "query":
            for ev in self._handle_query_stream(text, session, route_mode=route.mode):
                if ev[0] == "token":
                    yield ev
                else:
                    resp = ev[1]
        elif mode == "education":
            for ev in self._handle_education_stream(text, session):
                if ev[0] == "token":
                    yield ev
                else:
                    resp = ev[1]
        elif mode == "correction":
            for ev in self._handle_correction_stream(text, session):
                if ev[0] == "token":
                    yield ev
                else:
                    resp = ev[1]
        else:
            for ev in self._handle_casual_stream(text, session):
                if ev[0] == "token":
                    yield ev
                else:
                    resp = ev[1]

        if resp is None:
            resp = Response(message="Could not generate response.", action="chat")

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        resp.metadata.setdefault("latency_ms", elapsed_ms)
        resp.session_id = session_id
        session.messages.append({"role": "assistant", "content": resp.message})
        memory.add_message("assistant", resp.message, metadata=resp.metadata)
        self._persist_session(session)
        yield ("complete", resp)

    def _handle_query_stream(self, message: str, session: Session, route_mode: str = "accounting_qa"):
        prefer_nepali = session.language != "english"
        followup_term = self._resolve_followup_term(session, message)
        lookup_text = f"{followup_term} {message}" if followup_term else message
        gloss = format_glossary_answer(lookup_text, prefer_nepali=prefer_nepali)

        if gloss and (is_definition_question(message) or followup_term) and not is_complex_question(message):
            yield ("token", gloss)
            yield (
                "response",
                Response(message=gloss, action="info", metadata={"source": "ca_knowledge", "route": route_mode}),
            )
            return

        if needs_agent_tools(message):
            try:
                result = agent_loop(
                    [{"role": "user", "content": message}],
                    session_context={**session.context, "recent_parties": session.recent_parties},
                    session_id=session.session_id,
                )
                content = (result.get("content") or "").strip()
                if content:
                    parts: list[str] = []
                    for tok in self._stream_chat_llm(
                        message,
                        session,
                        extra_context=f"Tool results:\n{content[:1500]}",
                        mode_hint="Summarize these accounting tool results for the user.",
                    ):
                        parts.append(tok)
                        yield ("token", tok)
                    final = "".join(parts).strip() or content
                    yield (
                        "response",
                        Response(
                            message=final,
                            action="info",
                            metadata={"source": "agent", "tool_calls": result.get("tool_calls_made", [])},
                        ),
                    )
                    return
            except Exception as exc:
                logger.warning("Agent stream path failed: %s", exc)

        kb_context = format_kb_snippet(query=lookup_text) or ""
        task = task_for_route(route_mode)
        tiered_context = format_tiered_context(lookup_text, task=task, max_chars=1500)
        coa_context = format_coa_context(lookup_text, max_chars=1000)
        extra = ""
        if coa_context:
            extra += f"[CHART OF ACCOUNTS]\n{coa_context}\n"
        if tiered_context:
            extra += f"{tiered_context}\n"
        if kb_context:
            extra += f"[KNOWLEDGE BASE]\n{kb_context[:800]}\n"
        if gloss:
            extra += f"[GLOSSARY]\n{gloss}\n"

        model = DEEP_MODEL if is_complex_question(message) else FAST_MODEL
        parts: list[str] = []
        for tok in self._stream_chat_llm(
            message,
            session,
            extra_context=extra,
            mode_hint="Answer accounting question from context. Never use Hindi.",
            model=model,
        ):
            parts.append(tok)
            yield ("token", tok)
        reply = "".join(parts).strip() or gloss or kb_context
        yield (
            "response",
            Response(
                message=reply,
                action="info",
                metadata={"source": "llm+ca_context", "route": route_mode, "model": model},
            ),
        )

    def _handle_education_stream(self, message: str, session: Session):
        cited, _ = answer_with_citations(message, task="education")
        if cited:
            yield ("token", cited)
            yield ("response", Response(message=cited, action="info", metadata={"source": "citation+tutor"}))
            return
        resp = self._handle_education(message, session)
        yield ("token", resp.message)
        yield ("response", resp)

    def _handle_correction_stream(self, message: str, session: Session):
        parts: list[str] = []
        card = session.pending_card or session.context.get("last_posted_card")
        extra = "Reverse by swapping Dr/Cr on last entry lines." if card else ""
        for tok in self._stream_chat_llm(
            message,
            session,
            extra_context=extra,
            mode_hint="CORRECTION MODE: show reversing journal then fix.",
            model=DEEP_MODEL if card else FAST_MODEL,
        ):
            parts.append(tok)
            yield ("token", tok)
        yield ("response", Response(message="".join(parts), action="info", metadata={"source": "correction"}))

    def _handle_casual_stream(self, message: str, session: Session):
        if self._has_transaction_signals(message):
            resp = self._handle_entry(message, session)
            yield ("token", resp.message)
            yield ("response", resp)
            return
        if self._resolve_followup_term(session, message):
            yield from self._handle_query_stream(message, session)
            return
        parts: list[str] = []
        for tok in self._stream_chat_llm(message, session, mode_hint="CASUAL MODE: brief, warm."):
            parts.append(tok)
            yield ("token", tok)
        yield ("response", Response(message="".join(parts), action="chat"))

    def _empty_prompt(self, lang: str) -> str:
        if lang == "english":
            return "What would you like to enter or ask?"
        return "Ke lekhnu / sodhnu hunthyo? Udaharan: `Ram lai 500 udhaar diye`"


_default_manager: ConversationManager | None = None


def get_conversation_manager() -> ConversationManager:
    """Singleton conversation manager."""
    global _default_manager
    if _default_manager is None:
        _default_manager = ConversationManager()
    return _default_manager
