"""Romanized Nepali vocabulary normalization — Sections 2 & 4 of training corpus."""

from __future__ import annotations

import re
import unicodedata

# Filler particles to strip (Section 5.7)
FILLER_WORDS = frozenset({
    "ta", "ni", "hai", "yaar", "ho", "cha", "chha", "vayo", "vo", "bho",
    "bhayo", "gareko", "thiyo", "cha", "ra", "ko", "ma", "bata", "le",
})

# concept -> list of romanized variants (longest first for greedy replacement)
CONCEPT_VARIANTS: dict[str, tuple[str, ...]] = {
    "GIVE": (
        "udharoma diye", "khatama diye", "dinu vayo", "dieko", "deko cha",
        "udharo diye", "diye", "diyen", "dey", "deko",
    ),
    "RECEIVE": (
        "lini vayo", "lineko", "aaisakyo", "chukta garin", "liye", "liyo",
        "paye", "payo", "aayo",
    ),
    "CREDIT": (
        "udharoma", "khatama", "baki rakhera", "pachi tirne gari",
        "udhaaro", "udhaar", "udharo", "khata",
    ),
    "CASH": (
        "hatai hatai", "turuntai", "nagadma", "nagad", "cash ma", "cash",
    ),
    "OWE": (
        "tirna baki", "dinu baki", "aunu parne", "dinu parne", "baaki", "baki",
    ),
    "PAID_BACK": (
        "tirera diyo", "chukta garya", "chukta bhayo", "mitayo", "tirya",
        "tirin", "tirey", "tirya",
    ),
    "EARN": (
        "bikri bhayo", "aamdani", "kamai", "kamayo", "kamai",
    ),
    "EXPENSE_VERB": (
        "kharcha garya", "kharcha vayo", "kharcha lagyo", "paisa gayo",
        "kharcha bhayo", "khanyo",
    ),
    "BUY": (
        "kinera lyaye", "mal lyaye", "order garya", "mangaye", "mangayeko",
        "lyayeko", "lyaye", "kinye", "kinya", "kinyo",
    ),
    "SELL": (
        "bikri garya", "sell garya", "bech diye", "bechyo", "becha", "beche",
        "becera",
    ),
    "TODAY": ("aaja", "aja"),
    "YESTERDAY": ("hijo",),
    "TOMORROW": ("bholi", "voli"),
    "THIS_WEEK": ("yo hapta",),
    "THIS_MONTH": ("yo mahina",),
    "HOW_MUCH": ("kati ho", "kati vo", "kati vayo", "kati raixa", "kati"),
    "WHO": ("kaskaha bata", "kasle", "kasko", "ko"),
    "MONEY": ("rupaiya", "rupiya", "paisaa", "paisa"),
    "GOODS": ("samaan", "saman", "stock", "maal", "mal"),
    "CUSTOMER": ("khaneu", "customer", "grahak"),
    "SUPPLIER": (
        "thok byapari", "distributor", "dealer", "supplier", "farm", "company",
    ),
    "ACCOUNT": ("hisaab", "hisab", "account", "khata"),
    "LOW_STOCK": (
        "khatam huna lagyo", "sakisakyo", "sakiyo", "kam bhayo", "khatai vayo",
    ),
    "REMINDER": (
        "samjhaideu", "samjhaune", "yaad dilau", "yaad dilaune", "phone garideu",
        "tirna vana", "tirna vanne", "magne",
    ),
    "DISCOUNT": ("ghatai diye", "kam garidiye", "discount", "chhut"),
    "RETURN": ("return vayo", "return garyo", "pharki aayo", "pharkayo", "farkeko"),
    "RENT": ("pasal bhada", "ghar bhada", "thau bhada", "van bhada", "bhadaa", "bhada"),
    "SALARY": ("mazdur ko paisa", "jyala", "tanka", "talab"),
    "PERCENT": ("percent", "pratishat"),
}

# Build flat replacement map: variant -> canonical token
_VARIANT_TO_CANONICAL: dict[str, str] = {}
for concept, variants in CONCEPT_VARIANTS.items():
    canonical = concept.lower()
    for variant in sorted(variants, key=len, reverse=True):
        _VARIANT_TO_CANONICAL[variant.lower()] = canonical

# Supplier role indicators
SUPPLIER_HINTS = frozenset({
    "supplier", "dealer", "distributor", "thok", "byapari", "factory",
    "company", "farm", "import", "wholesaler", "thok pasal",
})

# Expense category hints
EXPENSE_HINTS = frozenset({
    "bhada", "rent", "bill", "bijuli", "light", "current", "talab", "tanka",
    "jyala", "mazdur", "transport", "truck", "van", "petrol", "gas",
    "internet", "repair", "commission", "ice", "service",
})


def normalize_unicode(text: str) -> str:
    """Normalize Devanagari input."""
    return unicodedata.normalize("NFC", text)


def strip_fillers(tokens: list[str]) -> list[str]:
    """Remove filler particles that carry no transactional meaning."""
    return [t for t in tokens if t.lower() not in FILLER_WORDS or len(t) > 3]


def light_clean(text: str) -> str:
    """Minimal cleaning for intent classification — preserves original Romanized tokens."""
    q = normalize_unicode(text.strip().lower())
    q = re.sub(r"[^\w\s\u0900-\u097F.%/-]", " ", q)
    q = re.sub(r"\s+", " ", q).strip()
    return q


def normalize_text(text: str) -> str:
    """Normalize Romanized Nepali spelling variants to canonical concept tokens."""
    q = light_clean(text)

    for variant, canonical in sorted(
        _VARIANT_TO_CANONICAL.items(), key=lambda x: len(x[0]), reverse=True
    ):
        q = re.sub(rf"\b{re.escape(variant)}\b", canonical, q)

    return q
