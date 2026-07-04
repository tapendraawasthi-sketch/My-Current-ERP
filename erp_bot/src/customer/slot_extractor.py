"""Extract structured slots from normalized Romanized Nepali text."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .vocabulary import SUPPLIER_HINTS

_WORD_NUMBERS: dict[str, int] = {
    "ek": 1, "dui": 2, "tin": 3, "char": 4, "panch": 5, "paanch": 5,
    "chha": 6, "saat": 7, "aath": 8, "nau": 9, "das": 10,
    "pandhra": 15, "bees": 20, "pachhis": 25, "pachis": 25,
    "tees": 30, "pachas": 50, "pachchis": 55,
    "saath": 60, "sattari": 70, "assi": 80, "nabbe": 90,
    "sau": 100, "hajar": 1000, "hazar": 1000, "lakh": 100000, "lakha": 100000,
    "crore": 10000000, "karod": 10000000,
}

_FRACTION_LAKH: dict[str, float] = {
    "dedh": 1.5, "sawa": 1.25, "paune": 0.75, "dhai": 2.5,
}

_DATE_PATTERNS = {
    "today": re.compile(r"\b(today|aaja|aja)\b"),
    "yesterday": re.compile(r"\bhijo\b"),
    "tomorrow": re.compile(r"\b(bholi|voli)\b"),
    "this_week": re.compile(r"\byo hapta\b"),
    "this_month": re.compile(r"\byo mahina\b"),
    "this_season": re.compile(r"\byo season\b"),
}

_PARTY_PATTERNS = [
    re.compile(
        r"\b([A-Za-z\u0900-\u097F][\w\u0900-\u097F\s]{0,30}?)\s+"
        r"(?:lai|ley|le|ko)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b([A-Za-z\u0900-\u097F][\w\u0900-\u097F\s]{0,30}?)\s+ko\s+(?:kati\s+)?baki\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b((?:thok\s+pasal|import\s+company|office\s+wala\s+dai|hotel\s+wala|"
        r"mithai\s+dokan|staff|teacher|hostel|contractor|coop|kisan|farm|dealer|"
        r"supplier|distributor|factory|company|retailer)[\w\s]*?)"
        r"\s+(?:lai|ley|le|bata|ko)\b",
        re.IGNORECASE,
    ),
]

_PARTY_STOPWORDS = frozenset({
    "aja", "hijo", "bholi", "kati", "kasle", "kun", "sabai", "malai",
    "timile", "uni", "customer", "grahak", "dokan", "pasal", "table",
    "staff", "party", "bihe", "dashain", "school", "office", "college",
    "naya", "purano", "mahina", "hapta", "season", "total", "bill",
})


@dataclass
class Slots:
    party: str | None = None
    amount: float | None = None
    amount_paid: float | None = None
    amount_total: float | None = None
    item: str | None = None
    direction: str | None = None
    date_ref: str | None = None
    party_role: str | None = None
    is_percent: bool = False
    raw_amount_text: str | None = None
    extras: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {}
        if self.party:
            d["party"] = self.party
        if self.amount is not None:
            d["amount"] = self.amount
        if self.amount_paid is not None:
            d["amount_paid"] = self.amount_paid
        if self.amount_total is not None:
            d["amount_total"] = self.amount_total
        if self.item:
            d["item"] = self.item
        if self.direction:
            d["direction"] = self.direction
        if self.date_ref:
            d["date_ref"] = self.date_ref
        if self.party_role:
            d["party_role"] = self.party_role
        if self.is_percent:
            d["is_percent"] = True
        if self.extras:
            d.update(self.extras)
        return d


def _parse_word_number_phrase(text: str) -> float | None:
    """Parse Nepali word-number phrases like 'dui hazar paanch sau'."""
    q = text.lower().strip()

    total = 0.0

    # Lakh phrases
    lakh_m = re.search(r"(\d+(?:\.\d+)?|dedh|sawa|paune|dhai)\s*(?:lakh|lakha)\b", q)
    if lakh_m:
        num_part = lakh_m.group(1)
        if num_part in _FRACTION_LAKH:
            total += _FRACTION_LAKH[num_part] * 100_000
        else:
            total += float(num_part) * 100_000

    # Hazar chunks: "dui hazar"
    for m in re.finditer(r"(\w+)\s+(?:hazar|hajar)\b", q):
        word = m.group(1)
        if word in _WORD_NUMBERS:
            total += _WORD_NUMBERS[word] * 1000
        elif re.match(r"^\d+$", word):
            total += float(word) * 1000

    # Sau chunks: "paanch sau", "pandhra sau"
    for m in re.finditer(r"(\w+)\s+sau\b", q):
        word = m.group(1)
        if word in _WORD_NUMBERS:
            total += _WORD_NUMBERS[word] * 100
        elif re.match(r"^\d+$", word):
            total += float(word) * 100

    # Standalone word numbers
    if total == 0:
        tokens = q.split()
        current = 0.0
        for tok in tokens:
            if tok in _WORD_NUMBERS:
                val = _WORD_NUMBERS[tok]
                if val >= 100:
                    current = (current or 1) * val
                else:
                    current += val
            elif re.match(r"^\d+(\.\d+)?$", tok):
                current += float(tok)
        total = current

    return total if total > 0 else None


def parse_amount(text: str) -> tuple[float | None, bool]:
    q = text.lower()

    pct = re.search(r"(\d+(?:\.\d+)?)\s*(?:%|percent|pratishat)", q)
    if pct:
        return float(pct.group(1)), True

    lakh = re.search(
        r"(\d+(?:\.\d+)?|dedh|sawa|paune|dhai)\s*(?:lakh|lakha)\b", q
    )
    if lakh:
        num_part = lakh.group(1)
        if num_part in _FRACTION_LAKH:
            return _FRACTION_LAKH[num_part] * 100_000, False
        return float(num_part) * 100_000, False

    digit = re.search(
        r"\b(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:ko|rupiya|rupaiya|paisa|rs\.?)?\b", q
    )
    if digit:
        return float(digit.group(1).replace(",", "")), False

    word_num_region = re.search(
        r"\b((?:\w+\s+){0,5}(?:sau|hazar|hajar|lakh|lakha|pandhra|dui|tin|char|panch|"
        r"das|bees|pachhis|pachas|ek|dedh|sawa|paune)(?:\s+\w+){0,4})\b",
        q,
    )
    if word_num_region:
        val = _parse_word_number_phrase(word_num_region.group(1))
        if val:
            return val, False

    return None, False


def extract_date_ref(text: str) -> str | None:
    for ref, pattern in _DATE_PATTERNS.items():
        if pattern.search(text):
            return ref
    return None


def _clean_party_name(name: str) -> str | None:
    cleaned = re.sub(r"\s+", " ", name.strip())
    cleaned = re.sub(
        r"\s+(?:wala|didi|dai|pasal|dokan|shop|store|bata)$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip()
    if not cleaned or cleaned.lower() in _PARTY_STOPWORDS:
        return None
    if len(cleaned) < 2:
        return None
    # Preserve multi-word names like "office wala dai", "hotel wala", "dokan wala"
    if " " in cleaned:
        return cleaned.title()
    return cleaned.title()


def extract_party(text: str) -> str | None:
    # Prefer explicit "Name lai" — use raw text to preserve "lai"
    for source in (text,):
        simple = re.search(
            r"\b([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s]{0,25}?)\s+(?:lai|ley)\b",
            source,
            re.IGNORECASE,
        )
        if simple:
            party = _clean_party_name(simple.group(1))
            if party and party.lower() not in ("staff", "table", "party", "new stock"):
                return party

        # "dealer lai", "supplier lai" — capture the role word as party name
        role = re.search(
            r"\b(dealer|supplier|distributor|kisan|factory|hostel|teacher|contractor|"
            r"retailer|coop|farm|grahak|customer)\s+lai\b",
            source,
            re.IGNORECASE,
        )
        if role:
            return role.group(1).title()

    for pattern in _PARTY_PATTERNS:
        m = pattern.search(text)
        if m:
            party = _clean_party_name(m.group(1))
            if party:
                return party
    return None


def infer_party_role(text: str, party: str | None) -> str | None:
    q = text.lower()
    combined = f"{q} {party or ''}".lower()
    if any(h in combined for h in SUPPLIER_HINTS):
        return "supplier"
    if any(w in combined for w in ("grahak", "customer", "khaneu")):
        return "customer"
    return None


def extract_item(text: str, party: str | None) -> str | None:
    q = text.lower()
    scrubbed = q
    if party:
        scrubbed = re.sub(re.escape(party.lower()), " ", scrubbed)

    item_match = re.search(
        r"\b((?:chamal|chini|tel|dudh|masu|tarkari|aalu|tamatar|saag|momo|maida|"
        r"butter|kurta|suruwal|juta|chappal|mobile|charger|earphone|cement|rod|"
        r"paint|paracetamol|dawai|insulin|copy|kalam|cartridge|kitab|cream|cake|"
        r"gas|cylinder|pitho|kukhura|dahi|beej|biskut|chiya|facial|makeup|"
        r"photocopy|school juta|bp machine|mithai|recharge|data pack|"
        r"[\w\u0900-\u097F]+)\s*(?:\d+\s*(?:kg|g|litre|l|wota|jodi|bora|dabba|ta|set)?)?)",
        scrubbed,
    )
    if item_match:
        item = item_match.group(1).strip()
        if item not in _PARTY_STOPWORDS and item not in ("nagad", "udharo", "credit", "baki"):
            qty = re.search(
                rf"{re.escape(item)}\s*(\d+\s*(?:kg|g|litre|l|wota|jodi|bora|dabba|ta|set)?)",
                scrubbed,
            )
            if qty:
                return f"{item} {qty.group(1).strip()}"
            return item
    return None


def extract_slots(normalized_text: str, raw_text: str | None = None) -> Slots:
    text = normalized_text
    slots = Slots()

    slots.date_ref = extract_date_ref(text)
    amount, is_pct = parse_amount(text)
    slots.amount = amount
    slots.is_percent = is_pct

    slots.party = extract_party(raw_text or text) or extract_party(text)
    slots.party_role = infer_party_role(text, slots.party)
    slots.item = extract_item(text, slots.party)

    partial = re.search(
        r"(\d+(?:,\d+)?)\s*(?:ko|ma)\s+(\d+(?:,\d+)?)\s*(?:matra|maatra)?",
        text,
    )
    if partial:
        slots.amount_total = float(partial.group(1).replace(",", ""))
        slots.amount_paid = float(partial.group(2).replace(",", ""))
        slots.amount = slots.amount_total

    return slots
