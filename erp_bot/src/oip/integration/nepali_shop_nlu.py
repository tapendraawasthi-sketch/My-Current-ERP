"""Permanent Romanized Nepali shop-speech layer for Ask Orbix.

Design principle: normalize once → match on canonical forms → never rely on
the cloud LLM for greetings, party khata, or purchase/sale surface variants.

Expand `_SHOP_SPELLING_VARIANTS` when new spoken forms appear; do not add
one-off handlers for every misspelling.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from ...nlu.text_normalize import normalize_accounting_text
from ...bridges.dexie_bridge import query_party_balance, set_active_session

# ---------------------------------------------------------------------------
# Permanent variant map — surface forms → canonical shop tokens
# ---------------------------------------------------------------------------
_SHOP_SPELLING_VARIANTS: dict[str, str] = {
    # purchase / buy family
    "kinye": "kineko",
    "kine": "kineko",
    "kinne": "kineko",
    "kinyo": "kineko",
    "kinya": "kineko",
    "kiniyo": "kineko",
    "kineye": "kineko",
    "kinera": "kineko",
    "kinchu": "kineko",
    "kinchhu": "kineko",
    "kinchha": "kineko",
    "kincha": "kineko",
    "kinna": "kineko",
    "bought": "kineko",
    "purchased": "kineko",
    "purchase": "kharid",
    # sale / sell family
    "bechye": "becheko",
    "bechyo": "becheko",
    "becha": "becheko",
    "bechera": "becheko",
    "bechchu": "becheko",
    "bechchhu": "becheko",
    "sold": "becheko",
    # pay / give / receive family
    "tire": "tiryo",
    "tireko": "tiryo",
    "tirera": "tiryo",
    "tirnu": "tirnu",
    "tirne": "tirnu",
    "dinu": "dinu",
    "dine": "dinu",
    "dineko": "diye",
    "diyeko": "diye",
    "deko": "diye",
    "diyo": "diye",
    "paunu": "paunu",
    "paune": "paunu",
    "payo": "paunu",
    "paayo": "paunu",
    # copula / particles
    "xa": "cha",
    "xaina": "chaina",
    "chha": "cha",
    "chh": "cha",
    "hunxa": "huncha",
    "hunchha": "huncha",
    # credit / cash
    "udhaar": "udhar",
    "udharo": "udhar",
    "udhaaro": "udhar",
    "nagad": "cash",
    "nakad": "cash",
    "nagar": "cash",
    # units
    "kilo": "kg",
    "kilos": "kg",
    "kilogram": "kg",
    "kilograms": "kg",
    "kgs": "kg",
    "gram": "g",
    "grams": "g",
    "liter": "ltr",
    "litre": "ltr",
    "liters": "ltr",
    "litres": "ltr",
    "piece": "pcs",
    "pieces": "pcs",
    "pc": "pcs",
}

_FILLER_STRIP = re.compile(
    r"\b(maile|mai|le|ta|ni|chai|pani|please|plz|hey|bro|dai|didi)\b",
    re.I,
)
_TRAILING_EMPHASIS = re.compile(r"\s+\bk\b\s*[.!?]?\s*$", re.I)

_GREETING = re.compile(
    r"^\s*("
    r"hi|hello|hey|namaste|namaskar|"
    r"k\s*(?:xa|cha)|ke\s*(?:xa|cha)|kasto\s*(?:xa|cha)|"
    r"halkhabar|hal\s*khabar|sanchai|sanchai\s*(?:xa|cha)|"
    r"good\s+(?:morning|afternoon|evening)|"
    r"what\s+can\s+you\s+do|help(?:\s+me)?|thanks|thank\s+you"
    r")\s*[!?.]*\s*$",
    re.I,
)

# Party obligation / balance families (after canonicalize)
_PARTY_KO_BAKI = re.compile(
    r"\b(?P<party>[A-Za-z\u0900-\u097F]{2,40})\s+ko\s+"
    r"(?:baki|balance|khata|udhar|hisab)\b",
    re.I,
)
_PARTY_LAI_OBLIGATION = re.compile(
    r"\b(?P<party>[A-Za-z\u0900-\u097F]{2,40})\s+lai\s+"
    r"(?:kati\s+)?(?:dinu|tirnu|paunu|dinu\s+parne|tirnu\s+parne|"
    r"dinu\s+parcha|tirnu\s+parcha|dinu\s+cha|tirnu\s+cha)\b",
    re.I,
)
_BARE_OBLIGATION = re.compile(
    r"\b(?:paisa|rupiya|rupees?|rs)?\s*"
    r"kati\s+(?:dinu|tirnu|paunu)(?:\s+par(?:cha|ne|yo))?(?:\s+cha)?\b|"
    r"\bkati\s+(?:baki|udhar)\b|"
    r"\b(?:tirnu|dinu|paunu)\s+par(?:cha|ne)\b",
    re.I,
)
_STOP_PARTY = frozenset(
    {
        "maile",
        "mai",
        "paisa",
        "kati",
        "ko",
        "lai",
        "cash",
        "bank",
        "aaja",
        "hijo",
        "today",
        "please",
        "thik",
        "sahi",
    }
)

_GREETING_HELP = (
    "Namaste! Ma Orbix ho — tapai ko hisab-kitab sahayog garna tayar chu.\n\n"
    "Try:\n"
    "• Party baki: \"Sweta lai kati dinu cha?\" / \"Ram ko baki\"\n"
    "• Kharid: \"chiura kineko 4 kg\" / \"maile dal kinye 2 kilo\"\n"
    "• Bikri: \"Ram lai 500 becheko\"\n"
    "• Report: \"cash kati cha\" / \"aaja entry kati\""
)


@dataclass(frozen=True)
class ShopNluHit:
    skip_llm: bool
    text: str
    intent: str
    method: str = "nepali_shop_nlu"
    operation_class: str | None = None
    party: str | None = None
    normalized: str = ""


def canonicalize_shop_message(text: str) -> str:
    """Collapse spoken Romanized variants to canonical tokens before matching."""
    raw = (text or "").strip()
    if not raw:
        return ""
    # Phrase-level unit rewrite before tokenization
    t = re.sub(r"\b(\d+(?:\.\d+)?)\s*kilos?\b", r"\1 kg", raw, flags=re.I)
    t = normalize_accounting_text(t)
    # Apply shop variant map (extends accounting normalize)
    tokens = re.findall(r"[\u0900-\u097F]+|[a-zA-Z0-9]+", t, re.I)
    out: list[str] = []
    for tok in tokens:
        if re.search(r"[\u0900-\u097F]", tok):
            out.append(tok)
        else:
            low = tok.lower()
            out.append(_SHOP_SPELLING_VARIANTS.get(low, low))
    joined = " ".join(out)
    joined = _FILLER_STRIP.sub(" ", joined)
    joined = _TRAILING_EMPHASIS.sub("", joined)
    return re.sub(r"\s+", " ", joined).strip()


def is_greeting_message(text: str) -> bool:
    canon = canonicalize_shop_message(text)
    if not canon or len(canon) > 64:
        return False
    return bool(_GREETING.match(canon) or _GREETING.match((text or "").strip()))


def extract_party_from_obligation(text: str) -> str | None:
    canon = canonicalize_shop_message(text)
    for pattern in (_PARTY_LAI_OBLIGATION, _PARTY_KO_BAKI):
        m = pattern.search(canon) or pattern.search(text or "")
        if m:
            party = m.group("party").strip()
            if party.lower() not in _STOP_PARTY:
                return party.title() if party.isascii() else party
    return None


def is_party_balance_query(text: str) -> bool:
    canon = canonicalize_shop_message(text)
    if _PARTY_LAI_OBLIGATION.search(canon) or _PARTY_KO_BAKI.search(canon):
        return True
    if _BARE_OBLIGATION.search(canon):
        return True
    # Original surface (pre-normalize) may still carry lai + dinu
    raw = text or ""
    if re.search(r"\blai\s+kati\s+(dinu|tirnu|paunu)\b", raw, re.I):
        return True
    if re.search(r"\bkati\s+(dinu|tirnu|paunu)\b", raw, re.I):
        return True
    return False


def _format_balance(party: str, result: dict[str, Any]) -> str:
    net = float(result.get("net_balance") or 0)
    source = result.get("source") or ""
    if source == "empty":
        return (
            f"{party} ko hisab session ma bheteko chaina. "
            "Ledger sync/open garnus, ani feri sodhnus."
        )
    if net > 0:
        return (
            f"{party} bata linu parne (receivable): "
            f"Rs. {net:,.2f}."
        )
    if net < 0:
        return (
            f"{party} lai dinu/tirnu parne (payable): "
            f"Rs. {abs(net):,.2f}."
        )
    return f"{party} ko baki: Rs. 0.00 (clear)."


def handle_shop_nlu(
    message: str,
    *,
    session_id: str = "",
    last_party: str | None = None,
    recent_parties: list[str] | None = None,
) -> ShopNluHit | None:
    """Deterministic shop-speech handler. Returns None when not applicable."""
    text = (message or "").strip()
    if not text:
        return None

    canon = canonicalize_shop_message(text)

    if is_greeting_message(text):
        return ShopNluHit(
            skip_llm=True,
            text=_GREETING_HELP,
            intent="greeting",
            operation_class="general_question",
            normalized=canon,
        )

    if not is_party_balance_query(text):
        return None

    party = extract_party_from_obligation(text)
    if not party:
        # Follow-up without party name — use discourse memory
        if last_party and str(last_party).strip():
            party = str(last_party).strip()
        elif recent_parties:
            for p in recent_parties:
                if p and str(p).strip():
                    party = str(p).strip()
                    break

    if not party:
        return ShopNluHit(
            skip_llm=True,
            text=(
                "Kun party ko hisab herne? "
                "Example: \"Sweta lai kati dinu cha?\" ya \"Ram ko baki\"."
            ),
            intent="party_balance_clarify",
            operation_class="erp_data_query",
            normalized=canon,
        )

    if session_id:
        set_active_session(session_id)
    result = query_party_balance(party, session_id or None)
    resolved = str(result.get("party") or party)
    return ShopNluHit(
        skip_llm=True,
        text=_format_balance(resolved, result),
        intent="party_balance",
        operation_class="erp_data_query",
        party=resolved,
        normalized=canon,
    )
