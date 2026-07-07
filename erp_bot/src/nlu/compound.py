"""Detect and split compound transaction messages."""

from __future__ import annotations

import re

_SPLIT = re.compile(r"\s+(?:ra|ani|and|,|;|\+)\s+", re.I)
_HAS_AMOUNT = re.compile(r"\d|saya|hajar|lakh|panch|das|bees", re.I)
_TX_VERB = re.compile(
    r"\b(becheko|bikri|kineko|tiryo|diye|kharcha|salary|talab|jama|aayo|payment|sold|paid)\b",
    re.I,
)


def split_compound_transactions(text: str) -> list[str]:
    """
    Split messages like 'Ram lai 5000 becheko ra 2000 cash aayo' into parts.
    Returns original text if not clearly compound.
    """
    t = (text or "").strip()
    if not t or not _HAS_AMOUNT.search(t):
        return [t]

    parts = [p.strip() for p in _SPLIT.split(t) if p.strip()]
    if len(parts) < 2:
        return [t]

    valid = [p for p in parts if _HAS_AMOUNT.search(p) and (_TX_VERB.search(p) or len(p) > 12)]
    return valid if len(valid) >= 2 else [t]


def is_payroll_with_statutory(text: str) -> bool:
    """Salary message mentioning SSF and/or TDS."""
    t = text.lower()
    return bool(re.search(r"\b(salary|talab)\b", t)) and bool(
        re.search(r"\b(ssf|tds|social\s*security|withhold|kataut|katayo)\b", t)
    )


def is_rent_with_tds(text: str) -> bool:
    t = text.lower()
    return bool(re.search(r"\b(rent|bhada|bhaada|kiraya)\b", t)) and bool(
        re.search(r"\b(tiryo|paid|diye|payment|tireko)\b", t)
    )
