from __future__ import annotations

import re

from .normalizer import normalize

CLARIFYING_QUESTION = "Hami le diye ki uniharule diye? (Who gave to whom?)"

_AMBIGUOUS_DIYE = re.compile(
    r"^\s*(\d+|(?:\d+\s+)?(?:saya|hajar|lakh|\w+))\s+(diye|die|diya|diae)\s*$",
    re.IGNORECASE,
)


def needs_party_role_clarification(text: str) -> bool:
    normalized = normalize(text)
    if not normalized:
        return False

    if re.search(r"\b(udhaar|udhar|credit|tiryo|payment|kharcha|kineko|becheko|cash|sold|purchase)\b", normalized):
        return False

    if re.search(r"\b(lai|le)\b", normalized):
        return False

    if _AMBIGUOUS_DIYE.match(normalized):
        return True

    if re.fullmatch(r"\d+\s+diye", normalized):
        return True

    return False
