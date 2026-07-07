"""
Contextual Word-Sense Disambiguation (WSD) for Nepali/Roman accounting utterances.

Resolves which verb/postposition pattern means what in context:
  Ram lai diye  → credit sale (we gave goods/credit to Ram)
  Ram le tiryo  → payment received (Ram paid us)
  Ram lai tiryo → payment made (we paid Ram)
  Ram bata kineko → purchase from Ram
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .text_normalize import normalize_for_matching, normalize_for_wsd, normalize_accounting_text

# Intent scores from grammatical direction (higher = stronger signal)
_DIRECTION_PATTERNS: list[tuple[str, str, float]] = [
    # (regex on normalized text, nlu_intent, weight)
    (r"\b\w+\s+lai\s+.*\b(udhar|credit)\b", "credit_sale", 0.92),
    (r"\b\w+\s+lai\s+.*\b(becheko|beche|bikri|diye|deko|diyeko|saman)\b", "credit_sale", 0.88),
    (r"\b\w+\s+le\s+.*\b(tiryo|tireko|aayo|diyo|diyeko|jama)\b", "payment_received", 0.9),
    (r"\b\w+\s+bata\s+.*\b(tiryo|aayo|diyo|prapti)\b", "payment_received", 0.85),
    (r"\b\w+\s+lai\s+.*\b(tiryo|tireko|payment|tirna)\b", "payment_made", 0.88),
    (r"\b\w+\s+bata\s+.*\b(kineko|kin|kharid|kinyo)\b", "credit_purchase", 0.86),
    (r"\b\w+\s+sanga\s+.*\b(kineko|kin|kharid)\b", "credit_purchase", 0.8),
    (r"\b(nagad|cash)\s+.*\b(becheko|beche|bikri|sold)\b", "cash_sale", 0.9),
    (r"\b(becheko|beche|bikri|sold)\s+.*\b(nagad|cash)\b", "cash_sale", 0.9),
    (r"\b(kineko|kharid|kin|bought|purchased)\s+.*\b(nagad|cash)\b", "cash_purchase", 0.88),
    (r"\b(kharcha|expense|bill|bijuli|bhaada|rent)\b", "expense", 0.75),
    (r"\b(salary|talab)\b", "salary", 0.85),
    (r"\b(aafai|afno|owner|malik)\s+.*\b(khaye|liye|consume|use)\b", "drawings", 0.9),
    (r"\b(vat\s+sahit|vat\s+bill)\b", "vat_sale", 0.7),
    (r"\b(firta|return|credit\s+note)\b.*\b(becheko|sale)\b", "sales_return", 0.8),
    (r"\b(firta|return)\b.*\b(kineko|purchase)\b", "purchase_return", 0.8),
    (r"\b(jama\s+gareko|deposit)\b", "contra", 0.75),
    (r"\b(loan|rin)\s+.*\b(liyo|received)\b", "loan_received", 0.8),
    (r"\b(loan|rin)\s+.*\b(tiryo|repay)\b", "loan_repayment", 0.8),
]

_AMBIGUOUS_VERBS = frozenset({"diye", "diyo", "liyo", "liye", "gareko", "garyo"})

_PAYMENT_WORDS = frozenset(
    {
        "cash", "nagad", "bank", "esewa", "khalti", "fonepay", "connectips",
        "cheque", "card", "online", "wallet", "mobile",
    }
)

_NON_TRANSACTION_CUES = re.compile(
    r"\b(aayena|band|cancel|reschedule|inquiry|comment|review|planning|quotation|"
    r"thaha\s*xaina|kamai\s*thorai|busy|idle|closed|no\s+customer|no\s+entry)\b",
    re.I,
)


@dataclass
class WSDResult:
    """Word-sense and discourse context for a single utterance."""

    normalized_text: str
    intent_scores: dict[str, float] = field(default_factory=dict)
    top_intent: str | None = None
    top_confidence: float = 0.0
    party: str | None = None
    payment_method: str = "unknown"
    is_likely_transaction: bool = True
    is_ambiguous: bool = False
    ambiguity_reason: str | None = None
    clarification_hint: str | None = None
    grammar_context: str = ""
    verb_signals: list[str] = field(default_factory=list)
    context_resolutions: list[str] = field(default_factory=list)

    def format_for_prompt(self, max_chars: int = 1200) -> str:
        lines = ["[CONTEXTUAL WORD-SENSE ANALYSIS]"]
        if self.top_intent:
            lines.append(
                f"Grammatical direction suggests: {self.top_intent} "
                f"(confidence {self.top_confidence:.2f})"
            )
        if self.party:
            lines.append(f"Likely party: {self.party}")
        if self.payment_method != "unknown":
            lines.append(f"Payment mode signal: {self.payment_method}")
        if self.verb_signals:
            lines.append(f"Key verbs detected: {', '.join(self.verb_signals[:6])}")
        if self.context_resolutions:
            lines.append("Discourse context:")
            lines.extend(f"  - {r}" for r in self.context_resolutions[:4])
        if self.is_ambiguous and self.clarification_hint:
            lines.append(f"Ambiguity: {self.clarification_hint}")
        if self.intent_scores:
            ranked = sorted(self.intent_scores.items(), key=lambda x: -x[1])[:4]
            lines.append(
                "Intent scoreboard: "
                + ", ".join(f"{k}={v:.2f}" for k, v in ranked)
            )
        if self.grammar_context:
            lines.append(self.grammar_context[: max_chars - len("\n".join(lines))])
        text = "\n".join(lines)
        return text[:max_chars]


def _score_directions(norm: str) -> dict[str, float]:
    scores: dict[str, float] = {}
    for pattern, intent, weight in _DIRECTION_PATTERNS:
        if re.search(pattern, norm, re.I):
            scores[intent] = max(scores.get(intent, 0.0), weight)
    return scores


def _detect_payment(norm: str) -> str:
    if re.search(r"\b(nagad|cash|nakad)\b", norm):
        return "cash"
    if re.search(r"\b(esewa)\b", norm):
        return "esewa"
    if re.search(r"\b(khalti)\b", norm):
        return "khalti"
    if re.search(r"\b(fonepay)\b", norm):
        return "bank"
    if re.search(r"\b(connectips|connect\s*ips)\b", norm):
        return "bank"
    if re.search(r"\b(cheque|check)\b", norm):
        return "cheque"
    if re.search(r"\b(card|swipe)\b", norm):
        return "bank"
    if re.search(r"\b(bank|online|mobile)\b", norm):
        return "bank"
    return "unknown"


def _extract_party(text: str, norm: str) -> str | None:
    for pat in (
        r"(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:lai|le|bata|ko|sanga)\b",
        r"(?:^|\s)([a-z]{2,18})\s+(?:lai|le|bata|ko|sanga)\b",
        r"([\u0900-\u097F]{2,24})\s+(?:lai|le|bata|को|ले|बाट)",
    ):
        m = re.search(pat, text, re.I)
        if m:
            name = m.group(1).strip()
            if name.lower() not in {
                "aaja", "aja", "hijo", "yo", "tyo", "mero", "hamro", "owner",
                "malik", "customer", "patient", "doctor", "clinic",
            }:
                return name.title() if name.isascii() else name
    return None


def _resolve_discourse(
    message: str,
    norm: str,
    session_context: dict[str, Any] | None,
) -> tuple[list[str], str | None, str | None]:
    """Use session slots / recent turns to fill gaps in short follow-ups."""
    resolutions: list[str] = []
    party_override: str | None = None
    intent_override: str | None = None
    if not session_context:
        return resolutions, party_override, intent_override

    pending = session_context.get("pending_slots") or {}
    last_intent = session_context.get("last_intent")
    recent_parties = session_context.get("recent_parties") or []

    # Short follow-up: "cash ma", "online", "Ram ko"
    short = len(norm.split()) <= 6
    if short and pending:
        if pending.get("party") and not re.search(r"\b(lai|le|bata)\b", norm):
            party_override = pending["party"]
            resolutions.append(f"Pending party from prior turn: {party_override}")
        if pending.get("intent") and not re.search(
            r"\b(becheko|kineko|tiryo|kharcha|diye)\b", norm
        ):
            intent_override = pending["intent"]
            resolutions.append(f"Pending intent from prior turn: {intent_override}")

    # "tyo", "wahi", "same" → last party
    if re.search(r"\b(tyo|wahi|same|uni|uha)\b", norm) and recent_parties:
        party_override = recent_parties[-1]
        resolutions.append(f"Pronoun resolved to recent party: {party_override}")

    # Payment-only follow-up after amount given
    if short and any(w in norm.split() for w in _PAYMENT_WORDS) and pending.get("amount"):
        resolutions.append(
            f"Payment mode follow-up for amount Rs {pending['amount']}"
        )
        if last_intent:
            intent_override = last_intent

    return resolutions, party_override, intent_override


def _check_ambiguity(norm: str, scores: dict[str, float]) -> tuple[bool, str | None]:
    if not scores:
        if re.search(r"\b(diye|diyo|liyo)\b", norm) and not re.search(r"\b(lai|le|bata)\b", norm):
            return True, (
                "Kasle kaslai diyo/tiryo? Party ra direction clear garnus — "
                "udhaar diye ho ki payment aayo?"
            )
        return False, None

    ranked = sorted(scores.values(), reverse=True)
    if len(ranked) >= 2 and ranked[0] - ranked[1] < 0.12:
        top_two = sorted(scores.items(), key=lambda x: -x[1])[:2]
        return True, (
            f"Do interpretations possible: {top_two[0][0]} vs {top_two[1][0]}. "
            "Cash ho ki udhaar? Kasle tiryo?"
        )

    if re.search(r"\b(diye|diyo)\b", norm) and "credit_sale" in scores and "payment_made" in scores:
        return True, "Diye = credit sale (lai) ho ki payment (le) — postposition hernu."

    return False, None


def analyze_context_wsd(
    message: str,
    session_context: dict[str, Any] | None = None,
    *,
    session_id: str = "default",
    include_grammar: bool = True,
) -> WSDResult:
    """
    Full contextual analysis: normalization, grammatical WSD, discourse, grammar RAG.
    """
    from ..khata.context_intelligence import analyze_message, build_intelligent_context

    raw = (message or "").strip()
    norm = normalize_for_wsd(raw)
    match_norm = normalize_for_matching(raw)
    analysis = analyze_message(raw, session_id=session_id)

    scores = _score_directions(norm)
    # Boost from context_intelligence intent keys
    _INTENT_KEY_MAP = {
        "khata_credit_sale": "credit_sale",
        "khata_payment_in": "payment_received",
        "khata_cash_sale": "cash_sale",
        "khata_purchase": "cash_purchase",
        "khata_expense": "expense",
        "khata_salary": "salary",
        "digital_payment": "cash_sale",
    }
    for key in analysis.intent_keys:
        mapped = _INTENT_KEY_MAP.get(key)
        if mapped:
            scores[mapped] = max(scores.get(mapped, 0.0), 0.72)

    resolutions, party_override, intent_override = _resolve_discourse(
        raw, norm, session_context
    )
    if intent_override:
        scores[intent_override] = max(scores.get(intent_override, 0.0), 0.82)

    top_intent = None
    top_conf = 0.0
    if scores:
        top_intent, top_conf = max(scores.items(), key=lambda x: x[1])

    party = party_override or _extract_party(raw, norm)
    if not party and analysis.party_hints:
        party = analysis.party_hints[0]

    payment = _detect_payment(match_norm)
    is_txn = analysis.is_transaction and not _NON_TRANSACTION_CUES.search(match_norm)
    ambiguous, clarify = _check_ambiguity(norm, scores)

    grammar_ctx = ""
    if include_grammar and is_txn:
        grammar_ctx = build_intelligent_context(raw, session_id=session_id)

    return WSDResult(
        normalized_text=normalize_accounting_text(raw),
        intent_scores=scores,
        top_intent=top_intent,
        top_confidence=top_conf,
        party=party,
        payment_method=payment,
        is_likely_transaction=is_txn,
        is_ambiguous=ambiguous,
        ambiguity_reason=clarify,
        clarification_hint=clarify,
        grammar_context=grammar_ctx,
        verb_signals=analysis.verb_signals,
        context_resolutions=resolutions,
    )


def apply_wsd_to_parsed(parsed: Any, wsd: WSDResult, *, min_override_conf: float = 0.78) -> Any:
    """
    Refine ParsedEntry using WSD when parser confidence is borderline or unknown.
    Mutates and returns parsed.
    """
    if not wsd.top_intent:
        return parsed

    should_override = (
        parsed.intent == "unknown"
        or parsed.confidence < 0.72
        or (wsd.is_ambiguous and parsed.confidence < 0.88)
    )

    if should_override and wsd.top_confidence >= min_override_conf:
        if wsd.top_intent in {
            "credit_sale", "cash_sale", "payment_received", "payment_made",
            "credit_purchase", "cash_purchase", "expense", "salary", "drawings",
            "vat_sale", "sales_return", "purchase_return", "contra",
            "loan_received", "loan_repayment",
        }:
            parsed.intent = wsd.top_intent  # type: ignore[assignment]
            parsed.confidence = max(parsed.confidence, min(0.88, wsd.top_confidence))

    if wsd.party and not parsed.party:
        parsed.party = wsd.party
        parsed.confidence = min(0.95, parsed.confidence + 0.05)

    if wsd.payment_method != "unknown" and parsed.payment_method == "unknown":
        parsed.payment_method = wsd.payment_method  # type: ignore[assignment]

    if wsd.is_ambiguous and wsd.clarification_hint and parsed.confidence < 0.8:
        parsed.needs_clarification = True
        if not parsed.clarification_question:
            parsed.clarification_question = wsd.clarification_hint

    return parsed
