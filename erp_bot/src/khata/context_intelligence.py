"""Context retrieval for e-Khata — routes IFRS vs grammar by message kind."""

from __future__ import annotations

import json
import re
from enum import Enum
from functools import lru_cache
from pathlib import Path

from ..vectorstore.ca_knowledge_store import (
    format_ifrs_context,
    get_ca_paragraphs_by_ids,
    search_ca_knowledge,
)
from ..vectorstore.nepali_grammar_store import format_grammar_context, search_nepali_grammar

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_KNOWLEDGE_JSON = _REPO_ROOT / "data" / "ekhata" / "conceptual-framework-knowledge.json"

_SESSION_META: dict[str, dict[str, str]] = {}

_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
_PARTY_RE = re.compile(
    r"\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?)\s+(?:le|lai|ko|sanga|bata)\b|"
    r"\b([A-Z][a-z]{2,})\s+(?:le|lai)\b",
    re.I,
)

# Common Roman-Nepali spelling variants → canonical form used in concept index
_ROMAN_ALIASES: dict[str, str] = {
    "sampati": "sampatti",
    "sampti": "sampatti",
    "sampatii": "sampatti",
    "dayitwo": "dayitwo",
    "dayitto": "dayitwo",
    "punji": "puni",
    "aamdani": "aamdani",
    "kharchaa": "kharcha",
}

_CONCEPT_QUESTION_RE = re.compile(
    r"\b("
    r"k\s*ho|k ho|kasari|kasto|what\s+is|what\s+are|define|definition|meaning|"
    r"paribhasha|explain|bhaneko|bhayo|matlab|vaneko|vanne|bhannu|ho\s*ki|"
    r"faithful\s+representation|recognition\s+criteria"
    r")\b",
    re.I,
)

_TRANSACTION_RE = re.compile(
    r"\b(\d+|saya|hajar|lakh)\b.*\b("
    r"udhaar|salary|ssf|gratuity|vat|tds|depreciation|bad\s*debt|loan|capital|"
    r"drawings|stock|kharcha|bikri|kineko|kinyo|tiryo|diyo|becheko|sold|purchase|"
    r"bought|payment|commission|advance|return|rent|bhaada|saman"
    r")\b",
    re.I,
)

_TRANSACTION_RE2 = re.compile(
    r"\b(sold|bought|paid|received|tiryo|kineko|kinyo|diyo|becheko)\b.*\d",
    re.I,
)

_GREETING_RE = re.compile(
    r"^(hello|hi|hey|namaste|namaskar|dhanyabad|thanks|thank you)\b",
    re.I,
)

_UNUSUAL_SPELLING_RE = re.compile(
    r"\b(chha|cha|xa|xha|xaina|chhaina|chaina|halkhabar|halkbr)\b|[\u0900-\u097F]",
    re.I,
)


class MessageKind(str, Enum):
    ACCOUNTING_CONCEPT = "accounting_concept"
    TRANSACTION = "transaction"
    GENERAL = "general"


def _session_meta(session_id: str) -> dict[str, str]:
    return _SESSION_META.setdefault(session_id, {})


def _normalize_text(text: str) -> str:
    low = re.sub(r"\s+", " ", (text or "").lower().strip())
    for alt, canonical in _ROMAN_ALIASES.items():
        low = re.sub(rf"\b{re.escape(alt)}\b", canonical, low)
    return low


@lru_cache(maxsize=1)
def _load_concepts() -> tuple[dict, ...]:
    if not _KNOWLEDGE_JSON.exists():
        return ()
    with open(_KNOWLEDGE_JSON, encoding="utf-8") as f:
        data = json.load(f)
    items: list[dict] = list(data.get("concepts", []))
    for entry in data.get("glossary", []):
        if isinstance(entry, dict) and entry.get("id"):
            items.append(entry)
    return tuple(items)


def _term_in_text(term: str, normalized_message: str) -> bool:
    t = _normalize_text(term)
    if len(t) < 3:
        return False
    if t in normalized_message:
        return True
    if re.search(rf"\b{re.escape(t)}\b", normalized_message):
        return True
    return False


def match_accounting_concepts(message: str) -> list[dict]:
    """Return concept/glossary entries whose en/ne terms appear in the message (most specific first)."""
    norm = _normalize_text(message)
    ranked: list[tuple[int, dict]] = []
    seen: set[str] = set()

    for concept in _load_concepts():
        cid = str(concept.get("id", ""))
        if not cid:
            continue
        terms = list(concept.get("en", [])) + list(concept.get("ne", []))
        best_len = 0
        for term in terms:
            t = _normalize_text(term)
            if _term_in_text(t, norm):
                best_len = max(best_len, len(t))
        if best_len:
            ranked.append((best_len, concept))

    ranked.sort(key=lambda pair: pair[0], reverse=True)
    hits: list[dict] = []
    for _, concept in ranked:
        cid = str(concept.get("id", ""))
        if cid in seen:
            continue
        seen.add(cid)
        hits.append(concept)
    return hits


def classify_message_kind(message: str) -> MessageKind:
    """Lightweight routing: accounting definition vs transaction vs general chat."""
    text = (message or "").strip()
    if not text:
        return MessageKind.GENERAL

    norm = _normalize_text(text)
    concepts = match_accounting_concepts(text)

    if _TRANSACTION_RE.search(text) or _TRANSACTION_RE2.search(text):
        return MessageKind.TRANSACTION

    if concepts and _CONCEPT_QUESTION_RE.search(text):
        return MessageKind.ACCOUNTING_CONCEPT

    if concepts and len(text.split()) <= 8 and not re.search(r"\b\d{2,}\b", text):
        return MessageKind.ACCOUNTING_CONCEPT

    if _GREETING_RE.match(norm) and len(text.split()) <= 6:
        return MessageKind.GENERAL

    if re.search(r"\b\d+\b", text) and re.search(
        r"\b(le|lai|ko|tiryo|diyo|kinyo|becheko|sold|bought|udhaar|payment)\b",
        text,
        re.I,
    ):
        return MessageKind.TRANSACTION

    if concepts:
        return MessageKind.ACCOUNTING_CONCEPT

    return MessageKind.GENERAL


def _expand_concept_query(message: str, concepts: list[dict]) -> str:
    parts = [message]
    for concept in concepts[:3]:
        parts.extend(concept.get("en", [])[:3])
        for pid in concept.get("paragraphs", [])[:4]:
            parts.append(f"Para {pid}")
            parts.append(f"IFRS {pid}")
    return " ".join(parts)


def _dedupe_hits(hits: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for hit in hits:
        key = str(hit.get("paragraph_id") or hit.get("chunk_id") or hit.get("text", ""))[:120]
        if key in seen:
            continue
        seen.add(key)
        out.append(hit)
    return out


def _party_hints(text: str) -> list[str]:
    hints: list[str] = []
    for m in _PARTY_RE.finditer(text):
        party = m.group(1) or m.group(2)
        if party and party.lower() not in {"cash", "bank", "sales", "purchase", "expense", "vat", "tds"}:
            hints.append(party)
    return hints[:2]


def build_intelligent_context(
    message: str,
    session_id: str = "default",
    *,
    force_ifrs: bool | None = None,
    force_grammar: bool | None = None,
) -> str:
    """Retrieve context chunks; IFRS-first for definitions, grammar-first for transactions."""
    text = (message or "").strip()
    if not text:
        return ""

    meta = _session_meta(session_id)
    kind = classify_message_kind(text)
    concepts = match_accounting_concepts(text)

    expand_parts = [text]
    if kind == MessageKind.TRANSACTION:
        if meta.get("last_party"):
            expand_parts.append(meta["last_party"])
        if meta.get("last_intent"):
            expand_parts.append(meta["last_intent"].replace("khata_", " "))
    elif kind == MessageKind.ACCOUNTING_CONCEPT and concepts:
        expand_parts = [_expand_concept_query(text, concepts)]

    query = " ".join(expand_parts)

    if force_grammar is not None:
        include_grammar = force_grammar
    elif kind == MessageKind.ACCOUNTING_CONCEPT:
        include_grammar = bool(_UNUSUAL_SPELLING_RE.search(text))
    else:
        include_grammar = True

    if force_ifrs is not None:
        include_ifrs = force_ifrs
    else:
        include_ifrs = True

    grammar_block = ""
    ifrs_block = ""

    if include_ifrs:
        ifrs_hits: list[dict] = []
        if kind == MessageKind.ACCOUNTING_CONCEPT and concepts:
            para_ids: list[str] = []
            for concept in concepts[:1]:
                para_ids.extend(str(p) for p in concept.get("paragraphs", [])[:6])
            if para_ids:
                direct = get_ca_paragraphs_by_ids(para_ids)
                order = {pid: i for i, pid in enumerate(para_ids)}
                direct.sort(
                    key=lambda h: order.get(str(h.get("paragraph_id", "")), 999),
                )
                ifrs_hits.extend(direct)
        ifrs_hits.extend(search_ca_knowledge(query, k=8 if kind == MessageKind.ACCOUNTING_CONCEPT else 4))
        ifrs_hits = _dedupe_hits(ifrs_hits)
        cap = 3 if kind == MessageKind.ACCOUNTING_CONCEPT else 8
        ifrs_block = format_ifrs_context(ifrs_hits[:cap])

    if include_grammar:
        grammar_k = 2 if kind == MessageKind.ACCOUNTING_CONCEPT else (5 if kind == MessageKind.TRANSACTION else 3)
        grammar_hits = search_nepali_grammar(query, k=grammar_k)
        grammar_block = format_grammar_context(grammar_hits)

    parts: list[str] = []
    if kind == MessageKind.ACCOUNTING_CONCEPT:
        if ifrs_block:
            parts.append(ifrs_block)
        if grammar_block:
            parts.append(grammar_block)
    else:
        if grammar_block:
            parts.append(grammar_block)
        if ifrs_block:
            parts.append(ifrs_block)

    return "\n\n".join(parts)


def update_session_from_message(session_id: str, message: str) -> None:
    """Track last party hints from user text for retrieval query expansion."""
    meta = _session_meta(session_id)
    hints = _party_hints(message)
    if hints:
        meta["last_party"] = hints[0]
    if _DEVANAGARI_RE.search(message):
        meta["has_devanagari"] = "1"


def update_session_from_card(session_id: str, card: dict) -> None:
    """Track confirmed entry metadata for follow-up messages."""
    meta = _session_meta(session_id)
    intent = card.get("intent")
    party = card.get("party")
    if intent:
        meta["last_intent"] = str(intent)
    if party:
        meta["last_party"] = str(party)


def clear_session_context(session_id: str) -> None:
    _SESSION_META.pop(session_id, None)
