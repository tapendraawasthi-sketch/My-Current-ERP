from __future__ import annotations

import re
from datetime import date, timedelta

from .normalizer import normalize, normalize_unicode_digits, parse_amount_words

PARTY_STOPWORDS = {
    "cash",
    "udhaar",
    "udhar",
    "credit",
    "payment",
    "purchase",
    "kharcha",
    "expense",
    "aja",
    "hijo",
    "parsi",
    "sold",
    "for",
    "tea",
    "saya",
    "hajar",
    "lakh",
}


def extract_amount(text: str) -> int | None:
    return parse_amount_words(text)


def _soft_normalize(text: str) -> str:
    text = normalize_unicode_digits(text)
    text = text.lower().strip()
    text = re.sub(r"[^\w\s\u0900-\u097F.]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def extract_party(text: str) -> str | None:
    soft = normalize(text)
    if not soft:
        return None

    match = re.search(
        r"\b([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{0,30}?)\s+(?:lai|le)\b",
        soft,
        re.IGNORECASE,
    )
    if match:
        party = match.group(1).strip()
        party_tokens = [token for token in party.split() if token.lower() not in PARTY_STOPWORDS]
        if party_tokens:
            return " ".join(party_tokens).title()

    capitalized = re.findall(r"\b([A-Z][a-z]{1,30})\b", text)
    for name in capitalized:
        if name.lower() not in PARTY_STOPWORDS:
            return name

    leading = re.match(r"^([a-z\u0900-\u097F]{2,30})\b", soft, re.I)
    if leading:
        candidate = leading.group(1).strip()
        if candidate.lower() not in PARTY_STOPWORDS and candidate.lower() not in {"hamile", "maile", "aja", "hijo"}:
            return candidate.title()

    return None


def extract_item(text: str, intent: str | None) -> str | None:
    soft = _soft_normalize(text)
    normalized = normalize(text)
    if not soft:
        return None

    if intent == "khata_purchase":
        match = re.search(r"\b(\w+)\s+kineko\b", soft)
        if match and match.group(1) not in PARTY_STOPWORDS:
            return match.group(1)
        match = re.search(r"\bpurchase\s+(\w+)\b", soft)
        if match:
            return match.group(1)
        match = re.search(r"\b(\w+)\s+ko\s+(\w+)\s+kineko\b", soft)
        if match:
            return match.group(2)

    if intent in ("khata_cash_sale", "khata_credit_sale"):
        match = re.search(r"\b(\w+)\s+ko\s+(\w+)\s+becheko\b", soft)
        if match and match.group(2) not in PARTY_STOPWORDS:
            return match.group(2)
        match = re.search(r"\b(\w+)\s+becheko\b", soft)
        if match and match.group(1) not in PARTY_STOPWORDS | {"cash", "750", "500", "ma"}:
            return match.group(1)
        match = re.search(r"\bsold\s+(\w+)\s+for\b", soft)
        if match:
            return match.group(1)

    if intent == "khata_expense":
        match = re.search(r"\b([a-zA-Z]+)\s+kharcha\b", soft)
        if match:
            return match.group(1)
        match = re.search(r"\bkharcha\s+([a-zA-Z]+)\b", soft)
        if match:
            return match.group(1)

    return None


def extract_date(text: str, today: date | None = None) -> date:
    base = today or date.today()
    normalized = normalize(text)

    if re.search(r"\bhijo\b", normalized):
        return base - timedelta(days=1)
    if re.search(r"\bparsi\b", normalized):
        return base + timedelta(days=1)
    if re.search(r"\baja\b", normalized):
        return base
    return base


def extract_entities(text: str, intent: str | None) -> dict[str, object]:
    party = extract_party(text)
    return {
        "AMOUNT": extract_amount(text),
        "PARTY": party if party else "UNKNOWN",
        "ITEM": extract_item(text, intent),
        "DATE": extract_date(text).isoformat(),
    }
