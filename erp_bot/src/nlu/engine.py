"""
Next-gen NLU Engine — uses fast LLM for structured extraction
when regex fails, falls back gracefully.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal, Optional

from ollama import Client
from pydantic import BaseModel, Field

from ..config import FAST_MODEL, FAST_MODEL_OPTIONS, OLLAMA_BASE_URL, REGEX_CONFIDENCE_THRESHOLD
from ..knowledge.chart_of_accounts_framework import get_nlu_vocabulary_summary
from ..knowledge.vocabulary_loader import (
    detect_payment_method as vocab_detect_payment_method,
    map_intent_hint_to_nlu,
    match_transaction_intent_hint,
)
from ..falcon_trader.normalizer import parse_amount_words
from .compound import is_payroll_with_statutory, is_rent_with_tds
from .context_wsd import analyze_context_wsd, apply_wsd_to_parsed
from .text_normalize import extract_amount as unified_extract_amount, normalize_for_wsd

logger = logging.getLogger(__name__)

IntentType = Literal[
    "credit_sale",
    "cash_sale",
    "payment_received",
    "payment_made",
    "cash_purchase",
    "credit_purchase",
    "expense",
    "salary",
    "vat_sale",
    "vat_purchase",
    "tds_deducted",
    "tds_paid",
    "loan_received",
    "loan_repayment",
    "capital_introduced",
    "drawings",
    "depreciation",
    "bad_debt_writeoff",
    "bad_debt_recovery",
    "provision",
    "contra",
    "journal",
    "discount_allowed",
    "discount_received",
    "bank_charges",
    "interest_income",
    "interest_expense",
    "prepaid",
    "accrued",
    "stock_adjustment",
    "sales_return",
    "purchase_return",
    "opening_balance",
    "closing_entry",
    "unknown",
]

PaymentMethod = Literal["cash", "bank", "cheque", "esewa", "khalti", "unknown"]

# Maps NLU intents → existing khata_* intent labels used by falcon_trader / khata_chat
INTENT_TO_KHATA: dict[str, str] = {
    "credit_sale": "khata_credit_sale",
    "cash_sale": "khata_cash_sale",
    "payment_received": "khata_payment_in",
    "payment_made": "khata_payment_out",
    "cash_purchase": "khata_purchase",
    "credit_purchase": "khata_credit_purchase",
    "expense": "khata_expense",
    "salary": "khata_salary_payment",
    "vat_sale": "khata_vat_sales",
    "vat_purchase": "khata_vat_purchase",
    "tds_deducted": "khata_tds_deducted",
    "tds_paid": "khata_tds_paid",
    "loan_received": "khata_loan_received",
    "loan_repayment": "khata_loan_repayment",
    "capital_introduced": "khata_capital_introduced",
    "drawings": "khata_drawings",
    "depreciation": "khata_depreciation",
    "bad_debt_writeoff": "khata_bad_debt_writeoff",
    "bad_debt_recovery": "khata_bad_debt_recovery",
    "provision": "khata_provision_bad_debt",
    "contra": "khata_contra_cash_bank",
    "discount_allowed": "khata_discount_allowed",
    "discount_received": "khata_discount_received",
    "bank_charges": "khata_bank_charges",
    "interest_income": "khata_other_income",
    "interest_expense": "khata_expense",
    "prepaid": "khata_prepaid_expense",
    "accrued": "khata_outstanding_expense",
    "stock_adjustment": "khata_inventory_write_down",
    "sales_return": "khata_sales_return",
    "purchase_return": "khata_purchase_return",
    "opening_balance": "khata_opening_balance",
}


class ParsedEntry(BaseModel):
    """Structured output schema for entry parsing."""

    intent: IntentType
    amount: Optional[float] = None
    party: Optional[str] = None
    narration: str
    confidence: float = Field(ge=0, le=1)
    vat_inclusive: bool = False
    tds_applicable: bool = False
    tds_rate: Optional[float] = None
    secondary_amount: Optional[float] = None
    tertiary_amount: Optional[float] = None
    payment_method: PaymentMethod = "unknown"
    transaction_date: Optional[str] = None
    statutory_bundle: bool = False
    needs_clarification: bool = False
    clarification_question: Optional[str] = None
    intent_code: Optional[str] = None
    knowledge_refs: list[str] = Field(default_factory=list)
    skip_posting: bool = False
    skip_reason: Optional[str] = None
    erp_action: Optional[str] = None
    policy_action: Optional[str] = None
    sector_slug: Optional[str] = None
    transaction_category: Optional[str] = None
    debit_accounts: list[str] = Field(default_factory=list)
    credit_accounts: list[str] = Field(default_factory=list)
    sector_template_id: Optional[str] = None

    @property
    def khata_intent(self) -> str | None:
        if self.intent == "unknown":
            return None
        return INTENT_TO_KHATA.get(self.intent)

    def to_khata_dict(self) -> dict[str, Any]:
        """Convert to dict compatible with falcon_trader / khata_chat parsers."""
        khata_intent = self.khata_intent
        if self.needs_clarification:
            return {
                "intent": None,
                "clarifying_question": self.clarification_question
                or "कति रकम हो? (What is the amount?)",
                "PARTY_ROLE": "UNKNOWN",
                "normalized_text": self.narration,
            }
        return {
            "intent": khata_intent,
            "clarifying_question": None,
            "PARTY_ROLE": "KNOWN" if self.party else "UNKNOWN",
            "normalized_text": self.narration,
            "AMOUNT": int(self.amount) if self.amount is not None else None,
            "PARTY": self.party,
            "ITEM": None,
            "DATE": None,
            "confidence": self.confidence,
            "payment_method": self.payment_method,
            "vat_inclusive": self.vat_inclusive,
            "tds_applicable": self.tds_applicable,
            "nlu_engine": True,
        }


class NLUEngine:
    """
    Two-pass NLU:
    Pass 1 — Regex (instant, <1ms) for common patterns
    Pass 2 — LLM structured output (for ambiguous/complex inputs)
    """

    NEPALI_AMOUNT_WORDS: dict[str, int] = {
        "ek": 1,
        "dui": 2,
        "tin": 3,
        "char": 4,
        "panch": 5,
        "chha": 6,
        "saat": 7,
        "aath": 8,
        "nau": 9,
        "das": 10,
        "bees": 20,
        "tees": 30,
        "chalis": 40,
        "pachas": 50,
        "saathi": 60,
        "satari": 70,
        "assi": 80,
        "nabbe": 90,
        "saya": 100,
        "hajar": 1000,
        "lakh": 100_000,
        "karod": 10_000_000,
        "arab": 1_000_000_000,
        "१": 1,
        "२": 2,
        "३": 3,
        "४": 4,
        "५": 5,
        "६": 6,
        "७": 7,
        "८": 8,
        "९": 9,
        "०": 0,
    }

    NEPALI_INTENT_PATTERNS: dict[str, list[str]] = {
        "credit_sale": [
            r"(?:lai|lāī)\s+.*?(?:udhaar|udharo|udhar|udhaaro)\s+(?:ma\s+)?(?:bech|diye|deko|bikri)",
            r"(?:lai|lāī)\s+.*?(?:bech|diye|deko).*?(?:udhaar|udharo|udhar)",
            r"(?:lai|lāī)\s+.*?\d+.*?(?:bech|becheko|bikri|diye|deko)",
            r"\d+.*?ko\s+saman\s+(?:becheko|bikri|bech)",
            r"(?:becheko|bikri).*?vat\s+sahit",
            r"credit\s+sale",
            r"(?:sold|sell).*(?:credit|on\s+account)",
            # NEW: "lai saman diye" patterns (gave goods = credit sale)
            r"(?:lai|lāī)\s+.*?(?:saman|goods?|maal)\s+(?:diye|deko|diyeko)",
            r"(?:lai|lāī)\s+.*?(?:marketing|bikri)\s+(?:garna|ko\s+lagi)\s+(?:saman|goods?)\s+(?:diye|deko)",
            r"(?:sathi|friend|mitra)\s+lai\s+.*?(?:saman|goods?)\s+(?:diye|deko)",
        ],
        "payment_received": [
            r"(?:le|bata)\s+.*?(?:tiryo|tireko|diyo|diyeko|jama|aayo)",
            r"(?:payment|paisa|rupiya)\s+(?:received|aayo|payo)",
            r"collected\s+.*?from",
            r"received\s+.*?from",
        ],
        "payment_made": [
            r"(?:lai)\s+.*?(?:payment|paisa|tirna)\s+(?:gareko|diye|diyeko)",
            r"paid\s+.*?to",
            r"payment\s+(?:made|gareko)",
        ],
        "expense": [
            r"(?:kharcha|kharch|expense|bill)\s+\d+",
            r"\d+\s+(?:kharcha|kharch|expense)",
            r"(?:electricity|bijuli|rent|bhada|phone|internet|pani|water)\s+(?:kharcha|bill|expense)",
            r"paid\s+.*?(?:for|rent|salary|wages|utilities)",
        ],
        "cash_sale": [
            r"(?:nagad|cash|nagar).*(?:bech|becheko|bikri|sold|gareko)",
            r"(?:bech|becheko|bikri|sold|gareko).*(?:nagad|cash)",
            r"(?:nagad|cash|nagar)\s+(?:ma\s+)?(?:bech|bikri|sold|gareko)",
            r"cash\s+(?:ma\s+)?(?:bikri|sale|bech)",
            r"(?:bikri|bech|sale)\s+(?:gareko\s+)?.*?(?:nagad|cash)",
            r"cash\s+sale",
        ],
        "credit_purchase": [
            r"(?:bata|from)\s+.*?(?:udhaar|udharo|credit)\s+(?:ma\s+)?(?:kin|kharid|saman)",
            r"(?:udhaar|udharo|credit)\s+(?:ma\s+)?.*?(?:kin|kharid|kineko|saman)",
            r"(?:bought|purchased).*?(?:on\s+credit|on\s+account)",
            r"credit\s+purchase",
        ],
        "cash_purchase": [
            r"(?:saman|mal|goods)\s+(?:kin|kharid|bought)",
            r"(?:kin|kharid|bought|purchased).*?(?:cash|nagad)",
            r"cash\s+purchase",
        ],
        "salary": [
            r"\b(salary|talab)\s+(?:payment|diyo|tiryo|paid)\b",
            r"\btalab\s+\d+",
        ],
        "vat_sale": [r"\bvat\s+(?:sale|bikri)\b", r"vat\s+sahit"],
        "vat_purchase": [r"\bvat\s+(?:purchase|kharid|kineko)\b"],
        "tds_deducted": [r"\b(tds\s*(?:deducted|kateko)|withholding\s*tax)\b"],
        "loan_received": [r"\bloan\s+received\b"],
        "loan_repayment": [r"\bloan\s+(?:repay|payment|tiryo)\b"],
        "depreciation": [r"\bdepreciation\b"],
        "sales_return": [r"\b(sales\s*return|saman\s*firta|firtayo)\b"],
        "purchase_return": [r"\bpurchase\s*return\b"],
        "opening_balance": [r"\b(opening\s*balance|suruwati\s*khata)\b"],
        "drawings": [
            r"(?:aafai|aafaile|afai|afno|owner|mero)\s+.*?(?:consume|khaye|liye|use|istimal|prayog)",
            r"(?:consume|khaye|use|istimal|prayog)\s+.*?(?:aafai|aafaile|afai|afno|owner|mero)",
            r"(?:personal|nijee|aafno)\s+(?:use|prayog|istimal|kaam)",
            r"(?:pasal|shop|business)\s+(?:ko\s+)?(?:saman|goods|mal)\s+.*?(?:aafai|mero|personal)",
            r"(?:owner|malik)\s+(?:le\s+)?(?:liye|khaye|nikale|consume)",
            r"\bdrawings?\b",
            r"\b(?:owner|malik)\s+(?:withdrawal|nikasi)\b",
            # NEW: more short patterns for drawings
            r"(?:owner|malik)\s+(?:le\s+)?(?:saman|goods|maal)\s+(?:aafai|khaye|liye)",
            r"(?:saman|goods|maal)\s+(?:aafai|owner\s+le)\s+(?:khaye|liye|consume)",
        ],
        "capital_introduced": [
            r"(?:owner|malik)\s+(?:le\s+)?(?:invest|lagani|jamma|diye|haleko)",
            r"(?:capital|punji)\s+(?:invest|lagani|jamma|haleko)",
            r"\bcapital\s+(?:introduced|investment|contribution)\b",
            r"(?:business|pasal)\s+(?:ma\s+)?(?:paisa|rakam)\s+(?:haleko|diye|lagani)",
        ],
        "stock_adjustment": [
            r"(?:stock|saman|mal)\s+(?:adjustment|milaunu|ghatyo|badyo)",
            r"(?:inventory|stock)\s+(?:loss|haani|shortage|damaged)",
            r"(?:physical|stock)\s+(?:count|ginti)\s+(?:diff|farak)",
        ],
    }

    _LLM_SYSTEM_PROMPT = """You are an expert Nepali/English CA-level accounting entry parser.
Given a message (Romanized Nepali, Devanagari, English, or mixed), extract EXACT transaction details.

CRITICAL RULES:
1. ALWAYS identify the correct double-entry intent from the list below
2. Extract EXACT numerical amount (convert Nepali words: hajar=1000, lakh=100000, saya=100)
3. Extract party name if mentioned (person, shop, business)
4. Do NOT assume a fixed VAT rate — if VAT applies, set vat_inclusive when user says "VAT sahit"; rates must be confirmed with CA/IRD
5. Determine payment method (cash=nagad, bank, cheque, esewa, khalti)
6. If ambiguous, set needs_clarification=true with Nepali question

CONTEXTUAL WORD-SENSE (le/lai/bata) — CRITICAL:
- "X lai diye/becheko/udhaar" → credit_sale (we gave/sold on credit TO X)
- "X le tiryo/aayo" → payment_received (X paid US)
- "X lai tiryo" → payment_made (WE paid X)
- "X bata kineko" → credit_purchase (bought FROM X)
- "nagad/cash + becheko" → cash_sale
- "nagad/cash + kineko" → cash_purchase
- "aafai/owner + liye/khaye" → drawings (personal use)
- Same verb (diye, liyo) changes meaning with postposition — NEVER guess without le/lai/bata

SESSION FOLLOW-UPS:
- Short replies like "cash ma", "online", "Ram ko" may complete a prior partial entry — use session context.
- "tyo/wahi/same" often refers to the most recent party in conversation.

NEPALI ACCOUNTING VOCABULARY:
Transaction verbs:
- udhaar/udharo diye = credit sale (to customer)
- udhaar tiryo = payment received from debtor
- nagad bikri/becheko = cash sale
- kineko/kharid = purchased
- tiryo/tireko = paid
- jama garyo = deposited
- nikale/liye = withdrew/took

Owner transactions (IMPORTANT):
- aafai/aafaile/afno + consume/khaye/liye/use = DRAWINGS (owner took goods for personal use)
- owner/malik + nikale/liye = DRAWINGS
- owner/malik + invest/lagani/haleko = CAPITAL_INTRODUCED
- personal use = DRAWINGS (Dr Drawings, Cr Stock/Purchase)

Other:
- kharcha = expense
- talab/salary = salary payment
- bhada/rent = rent expense
- byaj = interest
- haani/noksaan = loss
- nafa = profit
- firta/return = sales return or purchase return

INTENT LIST: credit_sale, cash_sale, payment_received, payment_made, credit_purchase, cash_purchase, expense, salary, drawings, capital_introduced, vat_sale, vat_purchase, loan_received, loan_repayment, depreciation, sales_return, purchase_return, stock_adjustment

""" + get_nlu_vocabulary_summary() + """

Output JSON with: intent, amount, party, narration, confidence, vat_inclusive, payment_method, needs_clarification, clarification_question"""

    def __init__(self, fast_model: str | None = None, base_url: str | None = None):
        self.fast_model = fast_model or FAST_MODEL
        self._client = Client(host=base_url or OLLAMA_BASE_URL)

    def parse(self, message: str, session_context: dict | None = None) -> ParsedEntry:
        """Two-pass parsing: WSD context → regex → LLM fallback."""
        text = (message or "").strip()
        if not text:
            return ParsedEntry(
                intent="unknown",
                narration="",
                confidence=0.0,
                needs_clarification=True,
                clarification_question="Ke lekhnu hunthyo? (What would you like to enter?)",
            )

        from .knowledge_enrich import enrich_parsed_entry

        session_id = (session_context or {}).get("session_id", "default")
        sector_slug = (session_context or {}).get("business_sector_slug")
        session_sector = (session_context or {}).get("business_sector")
        wsd = analyze_context_wsd(text, session_context, session_id=session_id)

        has_txn_signal = (
            wsd.is_likely_transaction
            or bool(re.search(r"\d", text))
            or bool(wsd.verb_signals)
            or bool(
                wsd.top_intent
                and wsd.top_confidence >= 0.7
                and wsd.top_intent != "unknown"
            )
        )
        if not has_txn_signal:
            return ParsedEntry(
                intent="unknown",
                narration=text,
                confidence=0.15,
                needs_clarification=False,
                skip_posting=True,
                skip_reason="non_transaction",
                clarification_question=(
                    "Yo transaction entry jasto chaina. Bikri/kinid/kharcha ko detail "
                    "cha bhane rakam sahit lekhnus."
                ),
            )

        regex_result = self._regex_parse(text)
        if regex_result and regex_result.confidence >= REGEX_CONFIDENCE_THRESHOLD:
            if not self._regex_ambiguous(text, regex_result):
                parsed = apply_wsd_to_parsed(
                    self._apply_statutory_hints(text, regex_result), wsd
                )
                return enrich_parsed_entry(
                    parsed,
                    text,
                    sector_profile=sector_slug,
                    session_sector=session_sector,
                )

        from .nearest_neighbor_intent import parse_with_nearest_neighbor

        nn_parsed = parse_with_nearest_neighbor(text, session_context)
        if nn_parsed and nn_parsed.intent != "unknown":
            parsed = apply_wsd_to_parsed(
                self._apply_statutory_hints(text, nn_parsed), wsd
            )
            return enrich_parsed_entry(
                parsed,
                text,
                sector_profile=sector_slug,
                session_sector=session_sector,
            )

        llm_result = self._llm_parse(text, session_context, regex_hint=regex_result, wsd=wsd)
        parsed = apply_wsd_to_parsed(self._apply_statutory_hints(text, llm_result), wsd)
        return enrich_parsed_entry(
            parsed,
            text,
            sector_profile=sector_slug,
            session_sector=session_sector,
        )

    def _regex_ambiguous(self, text: str, parsed: ParsedEntry) -> bool:
        """Force LLM review when regex match may be wrong."""
        t = text.lower()
        if parsed.payment_method == "cash" and re.search(r"\budhaar|credit\b", t):
            return True
        if re.search(r"\bvat\s+sahit\b", t) and parsed.intent in ("credit_sale", "cash_sale") and not parsed.vat_inclusive:
            return True
        if len(re.findall(r"\d+", text)) > 1 and re.search(r"\b(ra|ani|and|,)\b", t):
            return True
        return parsed.confidence < REGEX_CONFIDENCE_THRESHOLD

    def _apply_statutory_hints(self, text: str, parsed: ParsedEntry) -> ParsedEntry:
        if is_payroll_with_statutory(text):
            parsed.statutory_bundle = True
            if parsed.intent in ("unknown", "expense"):
                parsed.intent = "salary"
        if is_rent_with_tds(text):
            parsed.tds_applicable = True
            parsed.tds_rate = parsed.tds_rate or 0.10
            if parsed.intent == "expense":
                parsed.intent = "tds_deducted"
        parsed.transaction_date = parsed.transaction_date or self._extract_date(text)
        return parsed

    def parse_to_khata(self, message: str, session_context: dict | None = None) -> dict[str, Any]:
        """Parse and return falcon_trader-compatible dict."""
        return self.parse(message, session_context).to_khata_dict()

    def _regex_parse(self, message: str) -> Optional[ParsedEntry]:
        """Fast regex-based parsing for common patterns."""
        normalized = normalize_for_wsd(message)

        amount = self._extract_amount(message)
        party = self._extract_party(message)

        payment_method: PaymentMethod = "unknown"
        vocab_pm = vocab_detect_payment_method(normalized)
        if vocab_pm != "unknown":
            payment_method = vocab_pm  # type: ignore[assignment]
        elif re.search(r"\b(nagad|cash|nagar)\b", normalized):
            payment_method = "cash"
        elif re.search(r"\b(bank|cheque|check)\b", normalized):
            payment_method = "bank"
        elif re.search(r"\besewa\b", normalized):
            payment_method = "esewa"
        elif re.search(r"\bkhalti\b", normalized):
            payment_method = "khalti"

        intent: str | None = None
        
        # PRIORITY ORDER: Check cash patterns first if payment_method is cash
        priority_order = list(self.NEPALI_INTENT_PATTERNS.keys())
        if payment_method == "cash":
            # Move cash_sale and cash_purchase to front
            if "cash_sale" in priority_order:
                priority_order.remove("cash_sale")
                priority_order.insert(0, "cash_sale")
            if "cash_purchase" in priority_order:
                priority_order.remove("cash_purchase")
                priority_order.insert(1, "cash_purchase")
        
        for intent_name in priority_order:
            patterns = self.NEPALI_INTENT_PATTERNS.get(intent_name, [])
            for pattern in patterns:
                if re.search(pattern, normalized, re.IGNORECASE):
                    intent = intent_name
                    break
            if intent:
                break

        vat_inclusive = bool(re.search(r"\bvat\s+sahit\b", normalized))
        if not intent:
            intent = self._infer_intent_from_verbs(normalized, payment_method)

        if intent and amount:
            return ParsedEntry(
                intent=intent,  # type: ignore[arg-type]
                amount=amount,
                party=party,
                narration=message,
                confidence=0.9 if party else 0.85,
                payment_method=payment_method,
                vat_inclusive=vat_inclusive,
            )

        if intent and not amount:
            return ParsedEntry(
                intent=intent,  # type: ignore[arg-type]
                party=party,
                narration=message,
                confidence=0.5,
                needs_clarification=True,
                clarification_question="कति रकम हो? (What is the amount?)",
                payment_method=payment_method,
            )

        return None

    def _llm_parse(
        self,
        message: str,
        context: dict | None,
        regex_hint: Optional[ParsedEntry],
        wsd: Any | None = None,
    ) -> ParsedEntry:
        """LLM-powered parsing with structured output enforcement."""
        hint_text = ""
        if regex_hint:
            hint_text = (
                f"\nRegex hint: intent={regex_hint.intent}, "
                f"amount={regex_hint.amount}, party={regex_hint.party}"
            )

        context_text = ""
        if context:
            parts: list[str] = []
            if context.get("recent_parties"):
                parts.append(f"Recent parties: {', '.join(context['recent_parties'][-5:])}")
            if context.get("last_intent"):
                parts.append(f"Last transaction intent: {context['last_intent']}")
            if context.get("pending_slots"):
                slots = context["pending_slots"]
                slot_bits = [f"{k}={v}" for k, v in slots.items() if v]
                if slot_bits:
                    parts.append(f"Pending slots from prior turn: {', '.join(slot_bits)}")
            if context.get("business_sector"):
                parts.append(f"Business sector: {context['business_sector']}")
            if context.get("last_amount"):
                parts.append(f"Last mentioned amount: {context['last_amount']}")
            if parts:
                context_text = "\nSession context:\n" + "\n".join(f"- {p}" for p in parts)

        wsd_text = ""
        if wsd is not None:
            wsd_text = "\n\n" + wsd.format_for_prompt(max_chars=900)

        from .knowledge_enrich import format_nlu_knowledge_context

        knowledge_text = format_nlu_knowledge_context(
            message,
            sector_profile=(context or {}).get("business_sector_slug"),
            session_sector=(context or {}).get("business_sector"),
        )
        knowledge_block = f"\n\n{knowledge_text}" if knowledge_text else ""
        user_content = (
            f'Parse this accounting message: "{message}"'
            f"{hint_text}{context_text}{wsd_text}{knowledge_block}"
        )

        try:
            response = self._client.chat(
                model=self.fast_model,
                messages=[
                    {"role": "system", "content": self._LLM_SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                format=ParsedEntry.model_json_schema(),
                options=dict(FAST_MODEL_OPTIONS),
            )
            content = response.message.content
            if not content:
                raise ValueError("empty LLM response")
            return ParsedEntry.model_validate_json(content)
        except Exception as exc:
            logger.warning("NLU LLM parse failed: %s", exc)
            if regex_hint:
                return regex_hint
            return ParsedEntry(
                intent="unknown",
                narration=message,
                confidence=0.2,
                needs_clarification=True,
                clarification_question=(
                    "Yo entry bujhiyena. Rakam ra party clear lekhnus. "
                    "(Could not parse — please specify amount and party.)"
                ),
            )

    def _infer_intent_from_verbs(
        self, normalized: str, payment_method: PaymentMethod
    ) -> str | None:
        """Heuristic intent when regex patterns miss but amount/party are present."""
        hint = match_transaction_intent_hint(normalized)
        mapped = map_intent_hint_to_nlu(hint, payment_method)
        if mapped:
            return mapped
        if re.search(r"\b(becheko|beche|bikri|bech|sold|sell)\b", normalized):
            return "cash_sale" if payment_method == "cash" else "credit_sale"
        if re.search(r"\b(kineko|kharid|kin|bought|purchased)\b", normalized):
            return "cash_purchase" if payment_method == "cash" else "credit_purchase"
        if re.search(r"\b(tiryo|tireko|jama|aayo)\b", normalized):
            return (
                "payment_received"
                if re.search(r"\b(le|bata)\b", normalized)
                else "payment_made"
            )
        if re.search(r"\b(kharcha|expense|bill)\b", normalized):
            return "expense"
        if re.search(r"\bvat\b", normalized) and re.search(
            r"\b(bikri|sale|becheko)\b", normalized
        ):
            return "vat_sale"
        return None

    def _extract_amount(self, text: str) -> Optional[float]:
        """Extract numerical amount from mixed Nepali/English text."""
        val = unified_extract_amount(text)
        if val is not None:
            return val
        return self._extract_amount_legacy(text)

    def _extract_amount_legacy(self, text: str) -> Optional[float]:
        """Legacy amount extraction fallback."""
        match = re.search(r"(?:rs\.?|npr|रु\.?|₹)\s*([\d,]+(?:\.\d+)?)", text, re.I)
        if match:
            return float(match.group(1).replace(",", ""))

        match = re.search(r"([\d,]+(?:\.\d+)?)\s*(?:rs|rupees|rupiya|rupaiya)?", text)
        if match:
            raw = match.group(1).replace(",", "").strip()
            if raw:
                val = float(raw)
                if val > 0:
                    return val

        devanagari_map = str.maketrans("०१२३४५६७८९", "0123456789")
        converted = text.translate(devanagari_map)
        match = re.search(r"([\d,]+(?:\.\d+)?)", converted)
        if match:
            raw = match.group(1).replace(",", "").strip()
            if raw:
                val = float(raw)
                if val > 0:
                    return val

        word_amount = parse_amount_words(text)
        if word_amount and word_amount > 0:
            return float(word_amount)

        return None

    def _extract_party(self, text: str) -> Optional[str]:
        """Extract party name — Latin caps, lowercase Roman Nepali, Devanagari."""
        match = re.search(
            r"(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:lai|le|bata|ko|sanga)",
            text,
            re.IGNORECASE,
        )
        if match:
            name = match.group(1).strip()
            stopwords = {"aaja", "aja", "hijo", "bholi", "yo", "tyo", "mero", "hamro"}
            if name.lower() not in stopwords:
                return name.title()

        match = re.search(
            r"(?:^|\s)([a-z]{2,15})\s+(?:lai|le|bata|ko|sanga)\b",
            text,
            re.I,
        )
        if match:
            name = match.group(1).strip()
            stopwords = {
                "aaja", "aja", "hijo", "bholi", "yo", "tyo", "mero", "hamro", "uni", "uha",
                "malai", "timilai", "hajur", "owner", "malik", "sathi", "customer", "supplier",
            }
            if name.lower() not in stopwords:
                return name.title()

        match = re.search(r"([\u0900-\u097F]{2,20})\s+(?:lai|le|bata|को|ले|बाट)", text)
        if match:
            return match.group(1).strip()

        match = re.search(
            r"(?:from|to|paid|received)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
            text,
            re.I,
        )
        if match:
            return match.group(1).strip().title()

        return None

    def _extract_date(self, text: str) -> Optional[str]:
        """Extract relative or BS/AD date hints from text."""
        t = text.lower()
        if re.search(r"\baaja|aja|today\b", t):
            return "today"
        if re.search(r"\bhijo|yesterday\b", t):
            return "yesterday"
        if re.search(r"\bbholi|tomorrow\b", t):
            return "tomorrow"
        bs = re.search(r"(\d{4})\s*(?:shrawan|bhadra|ashwin|kartik|mangsir|poush|magh|falgun|chaitra|ashadh)", t)
        if bs:
            return bs.group(0)
        ad = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", text)
        if ad:
            return ad.group(1)
        return None

    def _normalize_nepali_numbers(self, text: str) -> str:
        """Convert Nepali number words to digits (whole words only)."""
        for word, val in sorted(
            self.NEPALI_AMOUNT_WORDS.items(),
            key=lambda x: -len(x[0]),
        ):
            text = re.sub(
                rf"(?<!\w){re.escape(word)}(?!\w)",
                str(val),
                text,
                flags=re.IGNORECASE,
            )
        return text


_default_engine: NLUEngine | None = None


def get_nlu_engine() -> NLUEngine:
    """Singleton NLU engine (lazy init)."""
    global _default_engine
    if _default_engine is None:
        _default_engine = NLUEngine()
    return _default_engine


def parse_entry(message: str, session_context: dict | None = None) -> ParsedEntry:
    """Convenience wrapper for one-shot parsing."""
    return get_nlu_engine().parse(message, session_context)
