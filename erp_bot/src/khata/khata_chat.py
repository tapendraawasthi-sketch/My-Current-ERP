"""e-Khata conversational LLM via Ollama — two-stage CA accounting brain."""

from __future__ import annotations

import json
import re
from datetime import date
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from ..config import KHATA_STRUCTURED_PARSE, MODEL_NAME, OLLAMA_BASE_URL
from ..falcon_trader import parse_khata_message
from ..vectorstore.ca_knowledge_store import search_ca_knowledge
from .extraction_prompt import EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_TEMPLATE
from .ollama_health import is_ollama_online
from .structured_parse import parse_extraction_response
from .system_prompt import KHATA_SYSTEM_PROMPT

_sessions: dict[str, list] = {}
_MAX_HISTORY = 24

# Stage 2 — response generation (natural language, moderate temperature)
_llm = ChatOllama(
    model=MODEL_NAME,
    base_url=OLLAMA_BASE_URL,
    temperature=0.35,
    num_ctx=8192,
)

# Stage 1 — structured extraction (deterministic JSON)
_llm_extract = ChatOllama(
    model=MODEL_NAME,
    base_url=OLLAMA_BASE_URL,
    temperature=0.0,
    num_ctx=4096,
    format="json",
)

INTENT_LABELS = {
    "khata_credit_sale": "Credit Sale (Udhaar / Receivable)",
    "khata_cash_sale": "Cash Sale",
    "khata_payment_in": "Payment Received",
    "khata_purchase": "Cash Purchase",
    "khata_payment_out": "Payment Made",
    "khata_expense": "Expense",
    "khata_credit_purchase": "Credit Purchase (Payable)",
    "khata_outstanding_expense": "Accrued Expense",
    "khata_bad_debt_writeoff": "Bad Debt Write-off",
    "khata_bad_debt_recovery": "Bad Debt Recovery",
    "khata_provision_bad_debt": "Provision for Bad Debts",
    "khata_salary_accrual": "Salary Accrual",
    "khata_salary_payment": "Salary Payment",
    "khata_ssf_employee": "SSF Employee (10%)",
    "khata_ssf_employer": "SSF Employer (11%)",
    "khata_gratuity_provision": "Gratuity Provision",
    "khata_gratuity_payment": "Gratuity Payment",
    "khata_vat_sales": "VAT Sale (13%)",
    "khata_vat_purchase": "VAT Purchase",
    "khata_vat_payment": "VAT Payment to IRD",
    "khata_tds_deducted": "TDS Deducted",
    "khata_tds_paid": "TDS Remittance",
    "khata_depreciation": "Depreciation",
    "khata_other_income": "Other Income",
    "khata_capital_introduced": "Capital Introduced",
    "khata_drawings": "Drawings",
    "khata_loan_received": "Loan Received",
    "khata_loan_repayment": "Loan Repayment",
    "khata_stock_purchase": "Stock Purchase",
    "khata_contra_cash_bank": "Contra Cash to Bank",
    "khata_sales_return": "Sales Return",
    "khata_purchase_return": "Purchase Return",
    "khata_customer_advance": "Customer Advance",
    "khata_employee_advance": "Employee Advance",
    "khata_opening_balance": "Opening Balance",
    "khata_asset_disposal": "Asset Disposal",
    "khata_inventory_write_down": "Inventory Write-down",
    "khata_commission_income": "Commission Income",
    "khata_rent_expense": "Rent Expense",
}


def _detect_language(text: str, hint: str | None = None) -> str:
    if hint in ("nepali", "english", "mixed"):
        return hint
    en = len(re.findall(
        r"\b(the|is|are|what|how|entry|debit|credit|account|journal|asset|liability)\b",
        text, re.I,
    ))
    ne = len(re.findall(
        r"\b(k\s*ho|kasari|udhaar|kharcha|bikri|tiryo|hisab|lekha|chha|hunchha)\b|[\u0900-\u097F]",
        text, re.I,
    ))
    if en > ne * 1.5:
        return "english"
    if ne > en * 1.5:
        return "nepali"
    return "mixed"


def _parsed_to_card(parsed: dict[str, Any], raw_text: str) -> dict[str, Any] | None:
    intent = parsed.get("intent")
    amount = parsed.get("AMOUNT")
    if not intent or not amount:
        return None
    card: dict[str, Any] = {
        "intent": intent,
        "party": None if parsed.get("PARTY") in (None, "UNKNOWN") else parsed.get("PARTY"),
        "amount": int(amount),
        "item": parsed.get("ITEM"),
        "date": parsed.get("DATE") or date.today().isoformat(),
        "raw_text": raw_text,
    }
    if parsed.get("journal_lines"):
        card["journalLines"] = parsed["journal_lines"]
    if parsed.get("ca_explanation"):
        card["caExplanation"] = parsed["ca_explanation"]
    return card


def _template_entry_reply(card: dict[str, Any], lang: str, *, offline: bool = False) -> str:
    label = INTENT_LABELS.get(card["intent"], card["intent"])
    party = card.get("party") or ("(no party)" if lang == "english" else "(party chaina)")
    amount = card["amount"]
    offline_note = ""
    if offline:
        offline_note = (
            "\n\n_(AI offline — basic entry mode active. Start `ollama serve` for full AI.)_"
            if lang == "english"
            else "\n\n_(AI offline — basic entry mode. Pura AI ko lagi `ollama serve` start garnus.)_"
        )
    if lang == "english":
        return (
            f"I understood this journal entry:\n"
            f"• Type: {label}\n"
            f"• Party: {party}\n"
            f"• Amount: NPR {amount:,}\n\n"
            f"Click **Confirm** if correct.{offline_note}"
        )
    return (
        f"Maile yo entry bujhe:\n"
        f"• Prakar: {label}\n"
        f"• Party: {party}\n"
        f"• Rakam: NPR {amount:,}\n\n"
        f"Sahi cha bhane **Confirm** thichnus.{offline_note}"
    )


def _template_clarify(question: str, lang: str) -> str:
    if lang == "english" and "Aaple" in question:
        return (
            "Did YOU give credit or did THEY pay?\n"
            "• `Ram lai 500 diye` = credit sale (udhaar)\n"
            "• `Shyam le 500 tiryo` = payment received"
        )
    if "Aaple" in question:
        return (
            f"{question}\n\n"
            "(Udhaar dine ho ki payment dine? Jastai: `Ram lai 500 diye` = udhaar; "
            "`Shyam le 500 diye` = payment.)"
        )
    if lang == "english":
        return f"{question}\n\nPlease include amount and party if applicable."
    return f"{question}\n\nThora clear lekhnus — rakam ra party bhannus."


def _balance_block(balance: dict[str, Any] | None) -> str:
    if not balance:
        return ""
    out = balance.get("udhaar_out")
    inn = balance.get("udhaar_in")
    if out is None and inn is None:
        return ""
    return (
        f"\n\n[CURRENT KHATA BALANCE]\n"
        f"Udharo baahir (receivable): NPR {int(out or 0):,}\n"
        f"Udharo bhitra (payable): NPR {int(inn or 0):,}"
    )


def _lang_instruction(lang: str) -> str:
    if lang == "english":
        return "\n\n[LANGUAGE] User writes in English. Reply in English."
    if lang == "nepali":
        return "\n\n[LANGUAGE] User writes in Nepali. Reply in Nepali (Roman or Devanagari matching user)."
    return "\n\n[LANGUAGE] User uses mixed Nepali/English. Match their style."


def _is_framework_question(text: str) -> bool:
    return bool(re.search(
        r"\b(ifrs|nas|conceptual\s+framework|recognition|derecognition|measurement|"
        r"faithful|relevance|comparability|materiality|going\s+concern|fair\s+value|"
        r"historical\s+cost|economic\s+resource|present\s+obligation|unit\s+of\s+account|"
        r"executory|substance|capital\s+maintenance|accrual\s+accounting|stewardship|"
        r"sampatti|dayitwo|manyata|mulyankan|biswasilo|sambandhit|nyaya\s+mulya|"
        r"paribhasha|ko\s+matlab|ko\s+paribhasha|k\s+ho)\b",
        text, re.I,
    ))


def _framework_context(text: str) -> str:
    """Retrieve IFRS Conceptual Framework paragraphs relevant to the question."""
    return _accounting_knowledge_context(text)


def _accounting_knowledge_context(text: str) -> str:
    """Retrieve IFRS framework + Nepal accounting knowledge for Q&A."""
    hits = search_ca_knowledge(text, k=4)
    if not hits:
        return ""
    lines = []
    for h in hits:
        pid = h.get("paragraph_id", "")
        section = h.get("section", "")
        body = h.get("text", "")
        item_type = h.get("item_type", "")
        if pid:
            label = f"[{item_type or 'Knowledge'} {pid}]" if item_type else f"[Para {pid}]"
            lines.append(f"{label} {section}\n{body}")
        else:
            lines.append(body)
    return (
        "[ACCOUNTING KNOWLEDGE — use as background, synthesize in user's language, do NOT copy verbatim]\n"
        + "\n\n".join(lines)
    )


def _is_accounting_knowledge_question(text: str) -> bool:
    """Broader than framework-only — triggers RAG for tax, NAS, transactions too."""
    if _is_framework_question(text):
        return True
    return bool(re.search(
        r"\b(vat|tds|ssf|ird|nas|nfrs|tax|kar|bhada|udhaar|provision|accrual|gratuity|bonus|pan|"
        r"fiscal|shrawan|ashadh|registration|threshold|exempt|withhold|corporate|cooperative|"
        r"input\s*vat|output\s*vat|labour\s*act|company\s*act|slab|remittance|reverse\s*charge|"
        r"deferred\s*tax|related\s*party|ipsas|ifrs\s*vs|nepal\s*ma)\b",
        text, re.I,
    ))


def _is_simplification_request(text: str) -> bool:
    return bool(re.search(
        r"\b(simple|saral|sajhilo|layman|easy|clear|bujhena|nabujheko|aru\s+palta|"
        r"pheri\s+bhannus|explain\s+again|give\s+in\s+simple)\b",
        text, re.I,
    ))


def _invoke_llm(
    message: str,
    session_id: str,
    balance: dict[str, Any] | None,
    lang: str,
    context: str = "",
) -> str:
    """Stage 2 — conversational response generation with session history."""
    history = _sessions.setdefault(session_id, [])
    system = KHATA_SYSTEM_PROMPT + _balance_block(balance) + _lang_instruction(lang)
    if context:
        system += f"\n\n[CONTEXT]\n{context}"
    if _is_simplification_request(message):
        system += (
            "\n\n[SIMPLIFICATION REQUEST] User did not understand. "
            "Give a NEW simpler answer: max 3 sentences, Nepal shopkeeper analogy, "
            "no jargon, no paragraph dumps, never say 'too complex'."
        )

    messages = [SystemMessage(content=system)]
    messages.extend(history[-_MAX_HISTORY:])
    messages.append(HumanMessage(content=message))

    try:
        result = _llm.invoke(messages)
        text = result.content if hasattr(result, "content") else str(result)
    except Exception as exc:
        if lang == "english":
            return f"Could not connect to Ollama: {exc}. Start `ollama serve` and erp_bot."
        return f"Ollama sanga jodna sakina: {exc}. `ollama serve` ra erp_bot start garnus."

    history.append(HumanMessage(content=message))
    history.append(AIMessage(content=text))
    if len(history) > _MAX_HISTORY:
        _sessions[session_id] = history[-_MAX_HISTORY:]

    return text.strip()


def _extract_transaction_llm(text: str, balance: dict[str, Any] | None) -> dict[str, Any]:
    """Stage 1 — structured extraction. No session history (evaluable in isolation)."""
    if not KHATA_STRUCTURED_PARSE or not is_ollama_online():
        return {"ok": False, "reason": "offline_or_disabled"}

    system = EXTRACTION_SYSTEM_PROMPT + _balance_block(balance)
    messages = [
        SystemMessage(content=system),
        HumanMessage(content=EXTRACTION_USER_TEMPLATE.format(message=text)),
    ]

    try:
        result = _llm_extract.invoke(messages)
        raw = result.content if hasattr(result, "content") else str(result)
    except Exception:
        return {"ok": False, "reason": "llm_error"}

    return parse_extraction_response(raw, text)


def _narrate_entry(
    text: str,
    card: dict[str, Any],
    session_id: str,
    balance: dict[str, Any] | None,
    lang: str,
) -> str:
    """Stage 2 — confirm parsed entry in user's language."""
    if not is_ollama_online():
        return _template_entry_reply(card, lang)

    llm_reply = _invoke_llm(
        text,
        session_id,
        balance,
        lang,
        context=(
            f"User posted a transaction. Parsed entry (DO NOT change amounts): "
            f"{json.dumps(card, ensure_ascii=False)}. "
            f"Confirm the entry in {'English' if lang == 'english' else 'Nepali'} "
            f"with Dr/Cr explanation. Tell them to click Confirm."
        ),
    )
    return llm_reply if len(llm_reply) > 40 else _template_entry_reply(card, lang)


def _is_accounting_question(text: str) -> bool:
    """Questions should go to Q&A, not transaction parsing."""
    if text.strip().endswith("?"):
        return True
    return bool(re.search(
        r"\b(k\s*ho|k\s*hun|ke\s*ho|kina|kasari|kati|kun|explain|define|bataau|bhannus|"
        r"matlab|arth|meaning|what\s+is|how\s+to|which\s+is)\b",
        text, re.I,
    ))


def _is_transaction_signal(text: str) -> bool:
    if _is_accounting_question(text):
        return False
    return bool(re.search(
        r"\b(\d+|saya|hajar|lakh)\b.*\b(udhaar|salary|ssf|gratuity|vat|tds|"
        r"depreciation|bad\s*debt|loan|capital|drawings|stock|kharcha|bikri|kineko|kinyo|"
        r"tiryo|diyo|becheko|sold|purchase|bought|payment|commission|advance|return|rent|bhaada)\b",
        text, re.I,
    )) or bool(re.search(r"\b(sold|bought|paid|received|tiryo|kineko)\b.*\d", text, re.I))


def _process_entry_rules(text: str, lang: str) -> dict[str, Any] | None:
    """Offline fallback — regex rules only."""
    parsed = parse_khata_message(text)

    if parsed.get("clarifying_question"):
        return {
            "kind": "clarify",
            "reply": _template_clarify(str(parsed["clarifying_question"]), lang),
            "card": None,
            "engine": "rules",
        }

    card = _parsed_to_card(parsed, text)
    if not card:
        return None

    return {
        "kind": "entry",
        "reply": _template_entry_reply(card, lang, offline=True),
        "card": card,
        "engine": "rules",
    }


def _process_entry(
    text: str,
    session_id: str,
    balance: dict[str, Any] | None,
    lang: str,
) -> dict[str, Any] | None:
    """LLM extraction first (Stage 1), regex fallback when offline (Stage 1b)."""
    online = is_ollama_online()

    if online and KHATA_STRUCTURED_PARSE:
        extraction = _extract_transaction_llm(text, balance)

        if extraction.get("ok") and extraction.get("is_question"):
            return None

        if extraction.get("ok") and extraction.get("clarify"):
            return {
                "kind": "clarify",
                "reply": _template_clarify(str(extraction["clarify"]), lang),
                "card": None,
                "engine": "ollama",
            }

        if extraction.get("ok") and extraction.get("card"):
            card = extraction["card"]
            reply = _narrate_entry(text, card, session_id, balance, lang)
            return {
                "kind": "entry",
                "reply": reply,
                "card": card,
                "session_id": session_id,
                "engine": "ollama",
            }

    # Offline or LLM extraction failed — regex fallback
    rules_result = _process_entry_rules(text, lang)
    if rules_result:
        rules_result["session_id"] = session_id
        return rules_result

    return None


def khata_chat(
    message: str,
    session_id: str,
    balance: dict[str, Any] | None = None,
    language: str | None = None,
) -> dict[str, Any]:
    """Two-stage brain: LLM extraction for entries, LLM response for Q&A."""
    text = (message or "").strip()
    lang = _detect_language(text, language)

    if not text:
        empty = (
            "What would you like to enter?"
            if lang == "english"
            else "Ke lekhnu hunthyo? Udaharan: `Ram lai 500 udhaar diye`"
        )
        return {"kind": "chat", "reply": empty, "card": None, "session_id": session_id, "engine": "rules"}

    if _is_transaction_signal(text):
        entry_result = _process_entry(text, session_id, balance, lang)
        if entry_result:
            return entry_result

    context = _accounting_knowledge_context(text) if _is_accounting_knowledge_question(text) else ""
    if not is_ollama_online():
        if lang == "english":
            offline_reply = (
                "AI is currently offline. Basic entry mode works for common transactions. "
                "Start `ollama serve` for full accounting Q&A."
            )
        else:
            offline_reply = (
                "AI ahile offline chha. Sadharan entry basic mode ma hunchha. "
                "Pura accounting Q&A ko lagi `ollama serve` start garnus."
            )
        return {
            "kind": "chat",
            "reply": offline_reply,
            "card": None,
            "session_id": session_id,
            "engine": "rules",
        }

    reply = _invoke_llm(text, session_id, balance, lang, context=context)
    return {
        "kind": "chat",
        "reply": reply,
        "card": None,
        "session_id": session_id,
        "engine": "ollama",
    }


def clear_session(session_id: str) -> None:
    _sessions.pop(session_id, None)
